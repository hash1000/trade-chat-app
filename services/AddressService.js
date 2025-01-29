const AddressRepository = require("../repositories/AddressRepository");

class AddressService {
  constructor() {
    this.addressRepository = new AddressRepository();
  }

  async getaddressByUserId(userId) {
    return await this.addressRepository.getaddressByUserId(userId);
  }
  
  async getaddressByType(userId,type) {
    return await this.addressRepository.getaddressByType(userId,type);
  }

  async addItemToCart(userId, productId, quantity) {
    return await this.addressRepository.addItemToCart(
      userId,
      productId,
      quantity
    );
  }

  async addAddress(user, addressDetails) {
    const { type, ...address } = addressDetails;
    const { id } = user;
    if (type.toLowerCase() === "delivery") {
      const requiredFields = ["firstName","middleName", "lastName", "country", "city", "postalCode", "street", "streetNumber", "deliveryNote"];
      for (const field of requiredFields) {
        if (!address[field]) {
          throw new Error(`Missing required field: ${field}`);
        }
      }
  
      const deliveryObj = {
        firstName: address.firstName,
        middleName: address.middleName,
        lastName: address.lastName,
        country: address.country,
        city: address.city,
        postalCode: address.postalCode,
        street: address.street,
        streetNumber: address.streetNumber,
        deliveryNote: address.deliveryNote,
      };
  
      return await this.addressRepository.addAddress(id, type, deliveryObj);
    } else if (type.toLowerCase() === "company") {
      const requiredFields = ["companyName", "firstName", "lastName", "country", "city", "postalCode", "street", "streetNumber", "vatNumber"];
      for (const field of requiredFields) {
        if (!address[field]) {
          throw new Error(`Missing required field: ${field}`);
        }
      }
  
      const companyObj = {
        companyName: address.companyName,
        firstName: address.firstName,
        lastName: address.lastName,
        country: address.country,
        city: address.city,
        postalCode: address.postalCode,
        street: address.street,
        streetNumber: address.streetNumber,
        vatNumber: address.vatNumber,
        customsNumber: address.customsNumber,
      };
  
      return await this.addressRepository.addAddress(id, type, companyObj);
    } else {
      throw new Error("Invalid address type. Allowed types are 'Delivery' and 'Company'.");
    }
  }
  

  
  async updatePinAddress(userId,addressId,type) {
    return await this.addressRepository.pinAddress(userId,addressId,type);
  }

  async removeItemFromCart(userId, productId) {
    return await this.addressRepository.removeItemFromCart(userId, productId);
  }
}

module.exports = AddressService;
