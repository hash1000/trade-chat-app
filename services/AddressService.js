const AddressRepository = require("../repositories/AddressRepository");

class AddressService {
  constructor() {
    this.addressRepository = new AddressRepository();
  }

  async getaddressByUserId(userId) {
    return await this.addressRepository.getAddressByUserId(userId);
  }

  async getaddressByType(userId, type) {
    return await this.addressRepository.getaddressByType(userId, type);
  }

  async addItemToCart(userId, productId, quantity) {
    return await this.addressRepository.addItemToCart(
      userId,
      productId,
      quantity
    );
  }

  async getAddressById(userId, addressId) {
    const address = await this.addressRepository.getAddressById(
      userId,
      addressId
    );

    if (!address) {
      throw new Error("Address not found or does not belong to the user.");
    }
    return address;
  }

  async getPinAddressByUserId(userId) {
    const address =  await this.addressRepository.getPinaddressByUserId(userId);
    return address;
  }
  
  async addAddress(user, addressDetails) {
    const { type, ...address } = addressDetails;
    const { id } = user;

    // Fetch existing addresses of the specified type for the user
    const existingAddress = await this.addressRepository.getaddressByUserId(
      user.id
    );

    if (type.toLowerCase() === "delivery") {
      const requiredFields = [
        "firstName",
        "middleName",
        "lastName",
        "title",
        "country",
        "city",
        "postalCode",
        "street",
        "streetNumber",
        "deliveryNote",
      ];
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
        title: address.title,
        postalCode: address.postalCode,
        street: address.street,
        pin: existingAddress.length === 0, // Set pin to true if no existing address of this type
        streetNumber: address.streetNumber,
        deliveryNote: address.deliveryNote,
      };

      return await this.addressRepository.addAddress(id, type, deliveryObj);
    } else if (type.toLowerCase() === "company") {
      const requiredFields = [
        "contactPerson",
        "companyName",
        "firstName",
        "lastName",
        "country",
        "city",
        "title",
        "postalCode",
        "street",
        "streetNumber",
        "vatNumber",
        "deliveryNote",
        "customsNumber",
      ];
      for (const field of requiredFields) {
        if (!address[field]) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      const companyObj = {
        contactPerson: address.companyName,
        companyName: address.companyName,
        firstName: address.firstName,
        lastName: address.lastName,
        country: address.country,
        city: address.city,
        title: address.title,
        postalCode: address.postalCode,
        street: address.street,
        pin: existingAddress.length === 0, // Set pin to true if no existing address of this type
        streetNumber: address.streetNumber,
        vatNumber: address.vatNumber,
        customerNumber: address.customsNumber,
        deliveryNote: address.deliveryNote,
      };

      return await this.addressRepository.addAddress(id, type, companyObj);
    } else {
      throw new Error(
        "Invalid address type. Allowed types are 'Delivery' and 'Company'."
      );
    }
  }

  async updateAddress(userId, addressId, updateFields) {
    // Fetch the address to ensure it belongs to the user
    const address = await this.addressRepository.getAddressById(
      userId,
      addressId
    );

    if (!address) {
      throw new Error("Address not found or does not belong to the user.");
    }

    // Update the address fields
    const updatedAddress = await this.addressRepository.updateAddress(
      addressId,
      updateFields
    );

    return updatedAddress;
  }

  async updatePinAddress(userId, addressId) {
    return await this.addressRepository.pinAddress(userId, addressId);
  }

  async removeItemFromCart(userId, productId) {
    return await this.addressRepository.removeItemFromCart(userId, productId);
  }

  async deleteAddress(userId, addressId) {
    // Fetch the address to ensure it belongs to the user
    const address = await this.addressRepository.getAddressById(
      userId,
      addressId
    );

    if (!address) {
      throw new Error("Address not found or does not belong to the user.");
    }

    // Delete the address
    return await this.addressRepository.deleteAddress(addressId);
  }
}

module.exports = AddressService;
