const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { Op } = require("sequelize");
const Notification = require("../models/notification");
const User = require("../models/user");
const Role = require("../models/role");
const jpush = require("../utilities/jpush");

const STAFF_ROLE_NAMES = ["admin", "accountant", "operator"];

// Prefer modern FCM HTTP v1 via firebase-admin when a service account file is
// available (the legacy fcm.googleapis.com/fcm/send API was shut down by Google
// in 2024). Drop the JSON at config/firebase-service-account.json or set
// FIREBASE_SERVICE_ACCOUNT_PATH in .env to activate real pushes.
let fcmAdmin = null;
try {
  const saPath = path.resolve(
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
      path.join(__dirname, "..", "config", "firebase-service-account.json"),
  );
  if (fs.existsSync(saPath)) {
    const admin = require("firebase-admin");
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(require(saPath)) });
    }
    fcmAdmin = admin;
    console.log("FCM: using firebase-admin (HTTP v1) with service account");
  }
} catch (error) {
  console.error("FCM: firebase-admin init failed, falling back to legacy API:", error.message);
}

class NotificationService {
  /**
   * Create a notification for one user (and best-effort FCM push).
   * Never throws — a failed notification must not break the main flow.
   */
  async notifyUser({
    userId,
    actorId = null,
    type,
    title,
    message,
    entityType = null,
    entityId = null,
    data = {},
  }) {
    try {
      const notification = await Notification.create({
        userId,
        actorId,
        type,
        title,
        message,
        entityType,
        entityId,
        data,
      });

      this._push(userId, title, message, {
        type,
        entityType,
        entityId,
        ...data,
      });

      return notification;
    } catch (error) {
      console.error("notifyUser error:", error.message);
      return null;
    }
  }

  /**
   * Create the same notification for every staff user (admin, accountant,
   * operator by default). The actor is excluded so staff members don't get
   * notified about their own actions. Never throws.
   */
  async notifyStaff({
    roles = STAFF_ROLE_NAMES,
    actorId = null,
    type,
    title,
    message,
    entityType = null,
    entityId = null,
    data = {},
  }) {
    try {
      const staff = await User.findAll({
        attributes: ["id"],
        include: [
          {
            model: Role,
            as: "roles",
            where: { name: { [Op.in]: roles } },
            attributes: [],
            through: { attributes: [] },
          },
        ],
      });

      const recipientIds = [...new Set(staff.map((u) => u.id))].filter(
        (id) => id !== actorId,
      );
      if (!recipientIds.length) return [];

      const rows = recipientIds.map((userId) => ({
        userId,
        actorId,
        type,
        title,
        message,
        entityType,
        entityId,
        data,
      }));

      const created = await Notification.bulkCreate(rows);

      this._pushMany(
        recipientIds.map((userId) => ({
          userId,
          title,
          body: message,
          data: { type, entityType, entityId, ...data },
        })),
      );

      return created;
    } catch (error) {
      console.error("notifyStaff error:", error.message);
      return [];
    }
  }

  /**
   * notifyUser for many recipients at once — one INSERT and one user lookup
   * for the pushes, instead of two queries per recipient. Use this for
   * fan-outs (a chat message to every group member): per-recipient
   * notifyUser calls there fill the DB pool and stall every other request
   * until they drain. Each entry: { userId, actorId, type, title, message,
   * entityType, entityId, data }. Never throws.
   */
  async notifyUsers(entries) {
    if (!entries.length) return [];
    try {
      const created = await Notification.bulkCreate(
        entries.map((e) => ({
          userId: e.userId,
          actorId: e.actorId ?? null,
          type: e.type,
          title: e.title,
          message: e.message,
          entityType: e.entityType ?? null,
          entityId: e.entityId ?? null,
          data: e.data ?? {},
        })),
      );

      this._pushMany(
        entries.map((e) => ({
          userId: e.userId,
          title: e.title,
          body: e.message,
          data: {
            type: e.type,
            entityType: e.entityType ?? null,
            entityId: e.entityId ?? null,
            ...(e.data || {}),
          },
        })),
      );

      return created;
    } catch (error) {
      console.error("notifyUsers error:", error.message);
      return [];
    }
  }

  async listForUser(
    userId,
    {
      pagination = false,
      page = 1,
      limit = 20,
      unreadOnly = false,
      type = null,
      autoRead = false,
    } = {},
  ) {
    const where = { userId };
    if (unreadOnly) where.isRead = false;
    if (type) where.type = type;

    const include = [
      {
        model: User,
        as: "actor",
        attributes: ["id", "firstName", "lastName", "username", "email", "profilePic"],
        required: false,
      },
    ];

    // unreadCount reflects the state BEFORE auto-read so the client can show
    // the badge value once, then it clears on the next fetch.
    const unreadCount = await Notification.count({
      where: { userId, isRead: false },
    });

    let notifications;
    let meta = {};

    if (!pagination) {
      notifications = await Notification.findAll({
        where,
        include,
        order: [["createdAt", "DESC"]],
      });
    } else {
      const { count, rows } = await Notification.findAndCountAll({
        where,
        include,
        order: [["createdAt", "DESC"]],
        limit,
        offset: (page - 1) * limit,
        distinct: true,
      });
      notifications = rows;
      meta = {
        totalItems: count,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
      };
    }

    // auto-read: mark the fetched notifications as read; the returned rows keep
    // isRead=false this one time so the app can still highlight them as new.
    if (autoRead && notifications.length) {
      const unreadIds = notifications.filter((n) => !n.isRead).map((n) => n.id);
      if (unreadIds.length) {
        await Notification.update(
          { isRead: true },
          { where: { id: { [Op.in]: unreadIds }, userId } },
        );
      }
    }

    return { notifications, unreadCount, ...meta };
  }

  async getUnreadCount(userId) {
    return Notification.count({ where: { userId, isRead: false } });
  }

  async markRead(userId, notificationId) {
    const notification = await Notification.findOne({
      where: { id: notificationId, userId },
    });
    if (!notification) return null;
    if (!notification.isRead) await notification.update({ isRead: true });
    return notification;
  }

  async markAllRead(userId) {
    const [updated] = await Notification.update(
      { isRead: true },
      { where: { userId, isRead: false } },
    );
    return updated;
  }

  async deleteForUser(userId, notificationId) {
    const deleted = await Notification.destroy({
      where: { id: notificationId, userId },
    });
    return deleted > 0;
  }

  async deleteAllForUser(userId) {
    return Notification.destroy({ where: { userId } });
  }

  // Push only — no notification row. For pushes that aren't part of the
  // in-app notification list (e.g. "X added you"). Never throws.
  push(userId, title, body, data = {}) {
    this._push(userId, title, body, data);
  }

  // Fire-and-forget push to the user's device: JPush when the app has
  // registered a JPush id (works in mainland China), otherwise FCM — via
  // firebase-admin (FCM v1) when a service account is configured, else the
  // legacy endpoint. The FCM branches go away once Firebase is removed.
  _push(userId, title, body, data = {}) {
    this._pushMany([{ userId, title, body, data }]);
  }

  // Same as _push for several recipients, with one query for all their
  // device tokens. items: [{ userId, title, body, data }].
  _pushMany(items) {
    const canJPush = jpush.isConfigured();
    if (!canJPush && !fcmAdmin && !process.env.FCM_SERVER_KEY) return;
    if (!items.length) return;
    const userIds = [...new Set(items.map((i) => i.userId))];
    User.findAll({
      where: { id: { [Op.in]: userIds } },
      attributes: ["id", "fcm", "jpushRegistrationId"],
    })
      .then((users) => {
        const byId = new Map(users.map((u) => [u.id, u]));
        for (const { userId, title, body, data = {} } of items) {
          const user = byId.get(userId);
          if (!user) continue;
          Promise.resolve()
            .then(() => this._sendToDevice(user, canJPush, title, body, data))
            .catch((error) => {
              const detail = error.response?.data ? JSON.stringify(error.response.data) : "";
              console.error("Push error:", error.message, detail);
            });
        }
      })
      .catch((error) => console.error("Push error:", error.message));
  }

  _sendToDevice(user, canJPush, title, body, data) {
    if (canJPush && user.jpushRegistrationId) {
      return jpush.sendToRegistrationId(user.jpushRegistrationId, title, body, data);
    }

    if (!user.fcm) return;

    if (fcmAdmin) {
      // FCM v1: data values must all be strings, and the whole message
      // must stay under 4KB — so the same capped extras as JPush.
      return fcmAdmin.messaging().send({
        token: user.fcm,
        notification: {
          title,
          body: body && body.length > 150 ? `${body.slice(0, 150)}…` : body,
          // Image messages: FCM shows the picture in the notification.
          ...(typeof data.imageUrl === "string" && /^https?:\/\//i.test(data.imageUrl)
            ? { imageUrl: data.imageUrl }
            : {}),
        },
        data: jpush.toStringExtras(data),
      });
    }

    // Legacy fallback (shut down by Google in 2024 — kept only until a
    // service account file is added; requests will fail harmlessly)
    return axios.post(
      "https://fcm.googleapis.com/fcm/send",
      {
        notification: { title, body },
        data: { data: JSON.stringify(data) },
        to: user.fcm,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `key=${process.env.FCM_SERVER_KEY}`,
        },
      },
    );
  }
}

module.exports = NotificationService;
