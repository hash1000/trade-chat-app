// services/TemplateService.js
const TemplateRepository = require("../repositories/TemplateRepository");

function notFound() {
  const err = new Error("Template not found.");
  err.statusCode = 404;
  return err;
}

// Every operation is scoped to the authenticated user's own templates.
class TemplateService {
  constructor() {
    this.templateRepository = new TemplateRepository();
  }

  async list(userId, { search } = {}) {
    return this.templateRepository.findAllForUser(userId, { search });
  }

  async get(userId, id) {
    const template = await this.templateRepository.findForUser(userId, id);
    if (!template) throw notFound();
    return template;
  }

  // New templates go to the end of the user's list.
  async create(userId, { title, subTitle }) {
    const sequence = await this.templateRepository.nextSequence(userId);
    return this.templateRepository.create({ userId, title, subTitle: subTitle ?? null, sequence });
  }

  async update(userId, id, { title, subTitle }) {
    const template = await this.get(userId, id);
    const changes = {};
    if (title !== undefined) changes.title = title;
    if (subTitle !== undefined) changes.subTitle = subTitle;
    if (Object.keys(changes).length) await template.update(changes);
    return template;
  }

  async remove(userId, id) {
    const template = await this.get(userId, id);
    await template.destroy();
  }

  // Copy of the template, appended at the end of the list.
  async duplicate(userId, id) {
    const source = await this.get(userId, id);
    return this.create(userId, { title: source.title, subTitle: source.subTitle });
  }

  async reorder(userId, orderedIds) {
    const ids = [...new Set(orderedIds)];
    if (ids.length !== orderedIds.length) {
      const err = new Error("orderedIds contains duplicates.");
      err.statusCode = 400;
      throw err;
    }
    const owned = await this.templateRepository.countOwned(userId, ids);
    if (owned !== ids.length) {
      const err = new Error("orderedIds contains templates that don't exist or aren't yours.");
      err.statusCode = 400;
      throw err;
    }
    await this.templateRepository.reorder(userId, ids);
    return this.list(userId);
  }
}

module.exports = TemplateService;
