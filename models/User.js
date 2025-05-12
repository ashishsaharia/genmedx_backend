const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  userEmail:{
    type: String, 
    required: true,
    unique: true, 
    trim: true, 
  },
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  phoneNumber: {
    type: Number, 
    required: true, 
  }, 
  userAge: {
    type: String, 
    required: true,
  },
  userGender: {
    type: String, 
    required: true,
  },
  userHeight: {
    type: Number, 
    required: true,
  },
  userWeight: {
    type: Number, 
    required: true,
  },
  userMedicalCondition: {
    type: String, 
  },
  userAlergies: { 
    type: String,
  },
  userEmergencyContact: {
    type: Number, 
    required: true,
  }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);