// Clean Initial State for AgriNex Marketplace

export const SEED_USERS = [
  {
    id: 'usr_farmer',
    name: 'Farmer',
    email: 'farmer@agrinex.com',
    password: 'password123',
    phone: '+91 98765 43210',
    role: 'FARMER',
    organization: 'Green Valley Farm',
    location: 'Guntur, Andhra Pradesh',
    coordinates: { lat: 16.3067, lng: 80.4365 },
    avatar: 'https://images.unsplash.com/photo-1595273670150-bd0c3c392e46?w=150&auto=format&fit=crop&q=80',
    verified: true,
    bankAccount: {
      accountNumber: 'XXXXXXXXXXXX',
      ifsc: 'XXXX000XXXX',
      bankName: 'XXXX Bank',
      upiId: 'XXXXXX@XXXX',
    },
  },
  {
    id: 'usr_fpo_lead',
    name: 'Sahyadri Farmers Producer Co. (FPO)',
    email: 'contact@sahyadrifpo.in',
    password: '',
    phone: '+91 94401 23456',
    role: 'FARMER',
    organization: 'Sahyadri Farmers Producer Co. Ltd',
    location: 'Guntur & Krishna Agro Cluster, Andhra Pradesh',
    coordinates: { lat: 16.3067, lng: 80.4365 },
    avatar: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=150&auto=format&fit=crop&q=80',
    verified: true,
    isFpo: true,
    fpoCin: 'U01409MH2021PTC123456',
    fpoLeader: {
      name: 'FPO Executive Lead',
      designation: 'Managing Director & FPO Leader',
      phone: '+91 94401 23456',
      password: '',
      govtId: 'Aadhaar Verified',
    },
    fpoMembers: [
      {
        id: 1,
        name: 'Suresh Reddy',
        phone: '9876543211',
        landAcres: '4.5',
        primaryCrops: 'Tomatoes, Guntur Chillies',
        verified: true,
      },
      {
        id: 2,
        name: 'Kishore Varma',
        phone: '9876543212',
        landAcres: '6.0',
        primaryCrops: 'Nashik Red Onions, Maize',
        verified: true,
      },
      {
        id: 3,
        name: 'Venkat Rao',
        phone: '9876543213',
        landAcres: '3.2',
        primaryCrops: 'Basmati Rice, Pulses',
        verified: true,
      },
    ],
    bankAccount: {
      accountNumber: 'XXXXXXXXXXXX',
      ifsc: 'XXXX000XXXX',
      bankName: 'XXXX Bank',
      upiId: 'XXXXXX@XXXX',
    },
  },
  {
    id: 'usr_consumer',
    name: 'Consumer',
    email: 'consumer@agrinex.com',
    password: 'password123',
    phone: '+91 98765 12345',
    role: 'BUYER',
    buyerType: 'Consumer',
    organization: 'Direct Buyer',
    location: 'Hyderabad, Telangana',
    coordinates: { lat: 17.385, lng: 78.4867 },
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    verified: true,
    bankAccount: {
      accountNumber: 'XXXXXXXXXXXX',
      ifsc: 'XXXX000XXXX',
      bankName: 'XXXX Bank',
      upiId: 'XXXXXX@XXXX',
    },
  },
  {
    id: 'usr_admin',
    name: 'Platform Admin',
    email: 'admin@agrinex.com',
    password: 'password123',
    phone: '+91 99999 88888',
    role: 'ADMIN',
    organization: 'AgriNex Operations',
    location: 'Amaravati Central Hub',
    coordinates: { lat: 16.5131, lng: 80.5165 },
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
    verified: true,
    bankAccount: {
      accountNumber: 'XXXXXXXXXXXX',
      ifsc: 'XXXX000XXXX',
      bankName: 'XXXX Bank',
      upiId: 'XXXXXX@XXXX',
    },
  },
];

// Completely empty initial lists as requested by user
export const SEED_PRODUCE = [];
export const SEED_ORDERS = [];
export const SEED_TRANSPORTERS = [];
export const SEED_NOTIFICATIONS = [];
export const SEED_DISPUTES = [];
