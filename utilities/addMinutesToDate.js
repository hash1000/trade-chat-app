// To add minutes to the current time
function AddMinutesToDate(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

// Use CommonJS module syntax
module.exports = AddMinutesToDate;
