// services/CurrencyService.js
const CurrencyRateAdjustment = require("../models/currencyRateAdjustment");
const fetch = require("node-fetch");

class CurrencyService {
  constructor() {
    // If you later introduce a CurrencyRepository, initialize it here
  }

  async getCurrentRate(baseCurrency = "USD", targetCurrency = "CNY") {
    try {
      const response = await fetch(
        `https://api.exchangerate.host/live?access_key=${process.env.EXCHANGE_RATE_API_KEY}`
      );
      const data = await response.json();

      if (!data.success) {
        throw new Error("Failed to fetch exchange rates");
      }

      const rateKey = `${baseCurrency}${targetCurrency}`;
      const currentRate = data.quotes[rateKey];

      if (!currentRate) {
        throw new Error(`Rate not available for ${baseCurrency} to ${targetCurrency}`);
      }

      return currentRate;
    } catch (error) {
      console.error("Error fetching exchange rate:", error);
      throw error;
    }
  }

  async transferAmount(amount, currentRate) {
    try {
      const adjustment = await CurrencyRateAdjustment.findOne({
        where: { targetCurrency },
        order: [["updatedAt", "DESC"]],
      });

      if (adjustment) {
        return {
          baseRate: adjustment.fetchedRate,
          adjustment: adjustment.adjustment,
          finalRate: adjustment.finalRate,
          lastUpdated: adjustment.updatedAt,
        };
      }

      const currentRate = await this.getCurrentRate("USD", targetCurrency);

      return {
        baseRate: currentRate,
        adjustment: 0,
        finalRate: currentRate,
        lastUpdated: new Date(),
      };
    } catch (error) {
      console.error("Error getting adjusted rate:", error);
      throw error;
    }
  }

  async getAdjustedRate(targetCurrency = "CNY") {
    try {
      const adjustment = await CurrencyRateAdjustment.findOne({
        where: { targetCurrency },
        order: [["updatedAt", "DESC"]],
      });

      if (adjustment) {
        return {
          baseRate: adjustment.fetchedRate,
          adjustment: adjustment.adjustment,
          finalRate: adjustment.finalRate,
          lastUpdated: adjustment.updatedAt,
        };
      }

      const currentRate = await this.getCurrentRate("USD", targetCurrency);

      return {
        baseRate: currentRate,
        adjustment: 0,
        finalRate: currentRate,
        lastUpdated: new Date(),
      };
    } catch (error) {
      console.error("Error getting adjusted rate:", error);
      throw error;
    }
  }

  async setRateAdjustment(userId, targetCurrency, adjustment) {
    try {
      const currentRate = await this.getCurrentRate("USD", targetCurrency);
      const finalRate = currentRate + adjustment;

      if (finalRate <= 0) {
        throw new Error("Final rate must be positive");
      }

      const [record, created] = await CurrencyRateAdjustment.upsert(
        {
          baseCurrency: "USD",
          targetCurrency,
          fetchedRate: currentRate,
          adjustment,
          finalRate,
          updatedBy: userId,
        },
        { returning: true }
      );

      return {
        baseRate: record.fetchedRate,
        adjustment: record.adjustment,
        finalRate: record.finalRate,
        wasNewRecord: created,
      };
    } catch (error) {
      console.error("Error setting rate adjustment:", error);
      throw error;
    }
  }

  async setRMBPrice(userId, amount) {
    try {
      const rate = await this.getCurrentRate("USD", "CNY");
      const convertedAmount = amount * rate;

      // You may want to save this or perform additional actions
      return {
        userId,
        usdAmount: amount,
        rmbRate: rate,
        convertedAmount,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error("Error setting RMB price:", error);
      throw error;
    }
  }
}

module.exports = CurrencyService;
 