const Order = require('./order');
const Document = require('./document');

Order.hasMany(Document, {
  foreignKey: 'orderNo',
  as: 'Document'
});

Document.belongsTo(Order, {
  foreignKey: 'orderNo'
});
