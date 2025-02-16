const db = require("../config/database");
const User = require("./user");
const Order = require("./order");
const Document = require("./document");

// Define associations here
Order.hasMany(Document, {
    foreignKey: 'orderNo', // Foreign key in Document
    sourceKey: 'orderNo',   // Matching field in Order
    as: 'documents' //
});
Document.belongsTo(Order, {
    foreignKey: 'orderNo', // Foreign key in Document
    targetKey: 'orderNo',   // Matching field in Order
    as: 'order'
});

module.exports = {
    db,
    User,
    Order,
    Document,
};
