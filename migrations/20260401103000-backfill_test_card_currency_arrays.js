"use strict";

const TEST_CARD_CURRENCIES = ["EUR", "USD"];

function normalizeCurrencyList(value) {
  if (value === undefined || value === null || value === "") {
    return [];
  }

  let rawValues;

  if (Array.isArray(value)) {
    rawValues = value;
  } else {
    const normalizedValue = String(value).trim();

    if (!normalizedValue) {
      return [];
    }

    if (normalizedValue.startsWith("[")) {
      try {
        const parsedValue = JSON.parse(normalizedValue);
        rawValues = Array.isArray(parsedValue) ? parsedValue : [];
      } catch (error) {
        rawValues = normalizedValue.split(/[\s,/]+/).filter(Boolean);
      }
    } else {
      rawValues = normalizedValue.split(/[\s,/]+/).filter(Boolean);
    }
  }

  const normalizedCurrencies = [...new Set(
    rawValues
      .map((entry) => String(entry || "").trim().toUpperCase())
      .filter((entry) => TEST_CARD_CURRENCIES.includes(entry)),
  )];

  return TEST_CARD_CURRENCIES.filter((currency) =>
    normalizedCurrencies.includes(currency),
  );
}

function getLegacyCurrencyValue(currencies) {
  if (!currencies.length || currencies.length > 1) {
    return null;
  }

  return currencies[0];
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const rows = await queryInterface.sequelize.query(
      `
        SELECT id, currency, accountCurrency
        FROM bank_accounts
        WHERE testCard = :testCard
      `,
      {
        replacements: { testCard: true },
        type: Sequelize.QueryTypes.SELECT,
      },
    );

    for (const row of rows) {
      const currencies = normalizeCurrencyList(
        row.accountCurrency ?? row.currency,
      );

      await queryInterface.bulkUpdate(
        "bank_accounts",
        {
          currency: getLegacyCurrencyValue(currencies),
          accountCurrency: currencies.length ? JSON.stringify(currencies) : null,
        },
        { id: row.id },
      );
    }
  },

  async down(queryInterface, Sequelize) {
    const rows = await queryInterface.sequelize.query(
      `
        SELECT id, currency, accountCurrency
        FROM bank_accounts
        WHERE testCard = :testCard
      `,
      {
        replacements: { testCard: true },
        type: Sequelize.QueryTypes.SELECT,
      },
    );

    for (const row of rows) {
      const currencies = normalizeCurrencyList(
        row.accountCurrency ?? row.currency,
      );
      const singleCurrency = getLegacyCurrencyValue(currencies) || "USD";

      await queryInterface.bulkUpdate(
        "bank_accounts",
        {
          currency: singleCurrency,
          accountCurrency: singleCurrency,
        },
        { id: row.id },
      );
    }
  },
};
