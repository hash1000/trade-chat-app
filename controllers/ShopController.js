const ShopService = require('../services/ShopService')
const shopService = new ShopService()

class ShopController {
  async createShop(req, res) {
    try {
      const { id: userId } = req.user
      const shop = await shopService.createShop(userId, req.body, req.files)
      return res.status(201).json(shop)
    } catch (error) {
      console.error(error)
      return res.status(error.statusCode || 500).json({ message: error.message || 'Failed to create shop' })
    }
  }

  async updateShop(req, res) {
    try {
      const { shopId } = req.params
      const { id: userId } = req.user

      const shop = await shopService.updateShop(shopId, userId, req.body, req.files)
      return res.json(shop)
    } catch (error) {
      console.error(error)
      return res.status(error.statusCode || 500).json({ message: error.message })
    }
  }

  async deleteShop(req, res) {
    try {
      const { shopId } = req.params
      const { id: userId } = req.user

      await shopService.deleteShop(shopId, userId)
      return res.json({ message: 'Shop deleted successfully' })
    } catch (error) {
      console.error(error)
      return res.status(error.statusCode || 500).json({ message: error.message })
    }
  }

  async getShops(req, res) {
    try {
      const { id: userId } = req.user
      const includeTeams = req.query.includeTeams === 'true'
      const includeMembers = req.query.includeMembers === 'true'
      const includeProducts = req.query.includeProducts === 'true'
      const page = Number(req.query.page) || 1
      const limit = Number(req.query.limit) || 10

      const data = await shopService.getShopsByUserId(userId, {
        includeTeams,
        includeMembers,
        includeProducts,
        page,
        limit,
      })
       return res.json({
        status: true,
        message: "Successfully fetched shops",
        data
      })
    } catch (error) {
      console.error(error)
      return res.status(500).json({ message: 'Failed to retrieve shops' })
    }
  }


  async getShopById(req, res) {
    try {
      const { id: userId } = req.user
      const { id } = req.params
      const includeTeams = req.query.includeTeams !== 'false'
      const includeMembers = req.query.includeMembers !== 'false'
      const includeProducts = req.query.includeProducts !== 'false'

      const shops = await shopService.getShopsById(userId, id, { includeTeams, includeMembers, includeProducts })
       return res.json({
        status: true,
        message: "Successfully fetched shops",
        data: shops
      })
    } catch (error) {
      console.error(error)
      return res.status(500).json({ message: 'Failed to retrieve shops' })
    }
  }

  async getPaginatedShops(req, res) {
    try {
      const { page = 1, limit = 10, shop_name, country } = req.query
      const data = await shopService.getPaginatedShops(page, limit, shop_name, country)
      return res.json({
        status: true,
        message: "Successfully fetched shops",
        data
      })
    } catch (error) {
      console.error(error)
      return res.status(500).json({ message: 'Failed to list shops' })
    }
  }

  // ── Teams ──────────────────────────────────────────────────────────────────

  async addTeams(req, res) {
    try {
      const { shopId } = req.params
      const { id: userId } = req.user
      const teamIds = req.body.teamIds ?? (req.body.teamId !== undefined ? [req.body.teamId] : undefined)

      if (!Array.isArray(teamIds) || teamIds.length === 0) {
        return res.status(422).json({ success: false, message: 'teamIds must be a non-empty array' })
      }

      const result = await shopService.addTeams(Number(shopId), userId, teamIds)
      return res.status(201).json({ success: true, message: 'Teams assigned to shop', data: result })
    } catch (error) {
      console.error(error)
      return res.status(error.statusCode || 500).json({ success: false, message: error.message })
    }
  }

  async removeTeam(req, res) {
    try {
      const { shopId, teamId } = req.params
      const { id: userId } = req.user

      await shopService.removeTeam(Number(shopId), userId, Number(teamId))
      return res.json({ success: true, message: 'Team removed from shop' })
    } catch (error) {
      console.error(error)
      return res.status(error.statusCode || 500).json({ success: false, message: error.message })
    }
  }

  // ── Members ────────────────────────────────────────────────────────────────

  async listMembers(req, res) {
    try {
      const { shopId } = req.params
      const page = Number(req.query.page) || 1
      const limit = Number(req.query.limit) || 10

      const result = await shopService.getMembers(Number(shopId), { page, limit })
      return res.json({ success: true, ...result })
    } catch (error) {
      console.error(error)
      return res.status(error.statusCode || 500).json({ success: false, message: error.message })
    }
  }

  async addMembers(req, res) {
    try {
      const { shopId } = req.params
      const { id: userId } = req.user
      const userIds = req.body.userIds ?? (req.body.userId !== undefined ? [req.body.userId] : undefined)

      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(422).json({ success: false, message: 'userIds must be a non-empty array' })
      }

      const result = await shopService.addMembers(Number(shopId), userId, userIds.map(Number))
      return res.status(201).json({ success: true, message: 'Members added to shop', data: result })
    } catch (error) {
      console.error(error)
      return res.status(error.statusCode || 500).json({ success: false, message: error.message })
    }
  }

  async removeMembers(req, res) {
    try {
      const { shopId } = req.params
      const { id: userId } = req.user
      const userIds = req.body.userIds ?? (req.body.userId !== undefined ? [req.body.userId] : undefined)

      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(422).json({ success: false, message: 'userIds must be a non-empty array' })
      }

      const result = await shopService.removeMembers(Number(shopId), userId, userIds.map(Number))
      return res.json({ success: true, message: 'Members removed from shop', data: result })
    } catch (error) {
      console.error(error)
      return res.status(error.statusCode || 500).json({ success: false, message: error.message })
    }
  }

  // ── Editor ─────────────────────────────────────────────────────────────────

  async setEditor(req, res) {
    try {
      const { shopId } = req.params
      const { id: userId } = req.user
      const editorId = req.body.editorId ?? req.body.editor

      if (editorId === undefined || editorId === null) {
        return res.status(422).json({ success: false, message: 'editorId is required' })
      }

      const shop = await shopService.setEditor(Number(shopId), userId, Number(editorId))
      return res.json({ success: true, message: 'Editor assigned to shop', data: shop })
    } catch (error) {
      console.error(error)
      return res.status(error.statusCode || 500).json({ success: false, message: error.message })
    }
  }

  async clearEditor(req, res) {
    try {
      const { shopId } = req.params
      const { id: userId } = req.user

      await shopService.clearEditor(Number(shopId), userId)
      return res.json({ success: true, message: 'Editor removed from shop' })
    } catch (error) {
      console.error(error)
      return res.status(error.statusCode || 500).json({ success: false, message: error.message })
    }
  }
}

module.exports = ShopController
