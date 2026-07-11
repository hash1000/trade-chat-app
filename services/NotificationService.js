const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { Op } = require("sequelize");
const Notification = require("../models/notification");
const User = require("../models/user");
const Role = require("../models/role");

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

      this._pushFcm(userId, title, message, {
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

      for (const userId of recipientIds) {
        this._pushFcm(userId, title, message, {
          type,
          entityType,
          entityId,
          ...data,
        });
      }

      return created;
    } catch (error) {
      console.error("notifyStaff error:", error.message);
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

  // Fire-and-forget push to the user's device. Uses firebase-admin (FCM v1)
  // when a service account is configured; otherwise tries the legacy endpoint.
  _pushFcm(userId, title, body, data = {}) {
    if (!fcmAdmin && !process.env.FCM_SERVER_KEY) return;
    User.findByPk(userId, { attributes: ["id", "fcm"] })
      .then((user) => {
        if (!user || !user.fcm) return;

        if (fcmAdmin) {
          // FCM v1: data values must all be strings
          const stringData = {};
          for (const [k, v] of Object.entries(data)) {
            if (v !== null && v !== undefined) stringData[k] = String(typeof v === "object" ? JSON.stringify(v) : v);
          }
          return fcmAdmin.messaging().send({
            token: user.fcm,
            notification: { title, body },
            data: stringData,
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
      })
      .catch((error) => {
        console.error("FCM push error:", error.message);
      });
  }
}

module.exports = NotificationService;
