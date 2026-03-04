// services/CurrencyService.js
// Fetches rates via EXCHANGE_RATE_API_KEY (exchangerate.host). Supports CNY, EUR, etc.
const CurrencyRateAdjustment = require("../models/currencyRateAdjustment");
const fetch = require("node-fetch");

class CurrencyService {
  constructor() {
    // If you later introduce a CurrencyRepository, initialize it here
  }

  async getCurrentRate(baseCurrency = "USD", targetCurrency = "CNY") {
    try {
      const response = await fetch(
        `https://v6.exchangerate-api.com/v6/${process.env.EXCHANGE_RATE_API_KEY}/latest/${baseCurrency}`
      );
      const data = await response.json();
      if (data.result !== 'success') {
        throw new Error("Failed to fetch exchange rates");
      }
      const conversion_rates = data.conversion_rates;
      const currentRate = conversion_rates[targetCurrency];
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

  async getAdjustedRate(targetCurrency = "CNY", baseCurrency = "USD") {
    try {
      const adjustment = await CurrencyRateAdjustment.findOne({
        where: { baseCurrency,targetCurrency },
        order: [["updatedAt", "DESC"]],
      });

      console.log(`Fetched adjustment for ${targetCurrency}:`, adjustment);
      if (adjustment) {
        return {
          baseRate: adjustment.fetchedRate,
          adjustment: adjustment.adjustment,
          finalRate: adjustment.finalRate,
          lastUpdated: adjustment.updatedAt,
        };
      }
      console.log(`No adjustment found for ${targetCurrency}, using current rate ${baseCurrency}`);
      const currentRate = await this.getCurrentRate(baseCurrency, targetCurrency);
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

  async setRateAdjustment(userId, currency, targetCurrency, adjustment) {
    try {
      const currentRate = await this.getCurrentRate(currency, targetCurrency);

      console.log(`Setting rate adjustment for ${targetCurrency}: currentRate=${currentRate}, adjustment=${adjustment}`);
      const finalRate = currentRate - adjustment;

      if (finalRate <= 0) {
        throw new Error("Final rate must be positive");
      }

      const [record, created] = await CurrencyRateAdjustment.upsert(
        {
          baseCurrency: currency,
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

  /**
   * Get USD->EUR rate and convert amount (for Euro pricing).
   * Use getCurrentRate("USD", "EUR") or getAdjustedRate("EUR") for rate-only; use this for conversion.
   */
  async setEuroPrice(userId, amount) {
    try {
      const rate = await this.getCurrentRate("USD", "EUR");
      const convertedAmount = amount * rate;

      return {
        userId,
        usdAmount: amount,
        eurRate: rate,
        convertedAmount,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error("Error setting Euro price:", error);
      throw error;
    }
  }
}

module.exports = CurrencyService;
 