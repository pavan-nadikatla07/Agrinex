import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || '';

let isConnected = false;

export async function connectToDatabase(): Promise<boolean> {
  if (isConnected && mongoose.connection.readyState === 1) return true;

  mongoose.set('strictQuery', false);
  mongoose.set('bufferCommands', false);

  if (!MONGO_URI) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'CRITICAL_DATABASE_ERROR: MONGO_URI environment variable is not configured. Database connection is required in production.'
      );
    }
    console.warn(
      '⚠️ [AgriNex Database Notice] MONGO_URI environment variable is not configured. ' +
      'AgriNex is running with robust in-memory local state fallback.'
    );
    return false;
  }

  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 3000,
    });
    isConnected = true;
    console.log('✅ Connected to MongoDB Atlas Database Cluster');
    return true;
  } catch (error: any) {
    const rawMsg = error instanceof Error ? error.message : String(error);
    const sanitizedMsg = rawMsg.replace(/mongodb(\+srv)?:\/\/[^@]+@/gi, 'mongodb+srv://[REDACTED]@');
    console.warn(`⚠️ [AgriNex Database Notice] Failed to connect to MongoDB Atlas: ${sanitizedMsg}`);
    isConnected = false;
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`CRITICAL_DATABASE_ERROR: Failed to connect to MongoDB Atlas in production: ${sanitizedMsg}`);
    }
    return false;
  }
}

export function isDbConnected(): boolean {
  return isConnected && mongoose.connection.readyState === 1;
}

export function assertDbConnection(): void {
  if (!MONGO_URI) {
    throw new Error(
      'DATABASE_CONFIGURATION_ERROR: MONGO_URI is missing. Please set a valid MongoDB Atlas connection string in environment.'
    );
  }
}

// User Schema (Farmers, Buyers, Admins, FPOs)
const UserSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, default: '' },
    phone: { type: String, required: true },
    password: { type: String, default: '' },
    role: {
      type: String,
      enum: ['FARMER', 'BUYER', 'ADMIN', 'FPO'],
      default: 'FARMER',
    },
    organization: { type: String, default: '' },
    location: { type: String, default: '' },
    coordinates: {
      lat: { type: Number, default: 16.3067 },
      lng: { type: Number, default: 80.4365 },
    },
    structuredLocation: {
      address: { type: String, default: '' },
      formattedAddress: { type: String, default: '' },
      placeId: { type: String, default: '' },
      latitude: { type: Number },
      longitude: { type: Number },
      city: { type: String, default: '' },
      district: { type: String, default: '' },
      state: { type: String, default: '' },
      country: { type: String, default: 'India' },
    },
    // Farmer transport option: Default false as mandated by business rule
    canManageTransport: { type: Boolean, default: false },
    rating: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    transportBonusCount: { type: Number, default: 0 },
    qualityFailedCount: { type: Number, default: 0 },
    successfulDeliveriesCount: { type: Number, default: 0 },
    verified: { type: Boolean, default: false },
    isFpo: { type: Boolean, default: false },
    fpoCin: { type: String, default: '' },
    fpoLeader: {
      name: { type: String, default: '' },
      designation: { type: String, default: 'Managing Director' },
      phone: { type: String, default: '' },
      password: { type: String, default: '' },
      govtId: { type: String, default: '' },
    },
    fpoMembers: [
      {
        id: { type: Number },
        name: { type: String, default: '' },
        phone: { type: String, default: '' },
        landAcres: { type: String, default: '' },
        primaryCrops: { type: String, default: '' },
        verified: { type: Boolean, default: true },
      },
    ],
    bankAccount: {
      bankName: { type: String, default: 'State Bank of India' },
      accountNumber: { type: String, default: '381928471928' },
      ifsc: { type: String, default: 'SBIN0001234' },
      upiId: { type: String, default: 'farmer@oksbi' },
      holderName: { type: String, default: '' },
    },
    avatar: { type: String, default: '' },
    authProvider: { type: String, enum: ['local', 'google'], default: 'local' },
    googleSubject: { type: String, default: '' },
    googleId: { type: String, default: '' },
    emailVerified: { type: Boolean, default: false },
  },
  { timestamps: true, strict: false }
);
UserSchema.index({ authProvider: 1, googleSubject: 1 });
UserSchema.index({ email: 1 });

// Produce Schema (Strict quality validation score > 70 required to be approved for marketplace)
const ProduceSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    category: { type: String, required: true },
    variety: { type: String, default: '' },
    quantity: { type: Number, required: true },
    availableQuantity: { type: Number, required: true },
    unit: { type: String, default: 'kg' },
    basePrice: { type: Number, required: true },
    aiRecommendedPrice: { type: Number, required: true },
    farmerId: { type: String, required: true },
    farmerName: { type: String, required: true },
    farmerPhone: { type: String, default: '' },
    farmerRating: { type: Number, default: 0 },
    canManageTransport: { type: Boolean, default: false },
    location: { type: String, default: '' },
    coordinates: {
      lat: { type: Number, default: 16.3067 },
      lng: { type: Number, default: 80.4365 },
    },
    structuredLocation: {
      address: { type: String, default: '' },
      formattedAddress: { type: String, default: '' },
      placeId: { type: String, default: '' },
      latitude: { type: Number },
      longitude: { type: Number },
      city: { type: String, default: '' },
      district: { type: String, default: '' },
      state: { type: String, default: '' },
      country: { type: String, default: 'India' },
    },
    qualityGrade: { type: String, default: 'Grade A' },
    aiQualityScore: { type: Number, default: 85 }, // Must be > 70 for marketplace approval
    aiQualityVerdict: {
      type: String,
      enum: ['APPROVED', 'REJECTED', 'PENDING_MANUAL_REVIEW'],
      default: 'APPROVED',
    },
    aiQualityNotes: { type: String, default: '' },
    inspectionId: { type: String, default: '' },
    videoSampleUrl: { type: String, default: '' },
    harvestDate: { type: String, default: '' },
    images: [{ type: String }],
    description: { type: String, default: '' },
  },
  { timestamps: true }
);

// Real Video Quality Inspection Result Schema
const QualityInspectionSchema = new mongoose.Schema(
  {
    inspectionId: { type: String, required: true, unique: true },
    produceName: { type: String, required: true },
    category: { type: String, default: '' },
    variety: { type: String, default: '' },
    farmerId: { type: String, default: '' },
    farmerName: { type: String, default: '' },
    farmerPhone: { type: String, default: '' },
    stockId: { type: String, default: '' },
    quantity: { type: Number, default: 0 },
    evidenceId: { type: String, default: '' },
    videoUrl: { type: String, default: '' },
    videoReferenceUrl: { type: String, default: '' },
    frameUrls: [{ type: String }],
    extractedFrames: [{ type: String }],
    evidenceReceived: { type: Boolean, default: false },
    evidenceQuality: { type: String, default: 'GOOD' },
    productDetected: { type: Boolean, default: true },
    productType: { type: String, default: '' },
    productIdentified: { type: String, default: '' },
    pipelineState: {
      type: String,
      enum: [
        'NO_VIDEO',
        'VIDEO_RECEIVED',
        'PROCESSING',
        'AI_ANALYSIS',
        'AI_APPROVED',
        'AI_QUALITY_FAILED',
        'AI_SERVICE_UNAVAILABLE',
        'AI_PROCESSING_FAILED',
        'ADMIN_REVIEW',
        'ADMIN_APPROVED',
        'ADMIN_REJECTED',
      ],
      default: 'VIDEO_RECEIVED',
    },
    aiStatus: { type: String, default: '' },
    qualityScore: { type: Number, default: null }, // Nullable: 0-100 when analyzed, null on service error
    score: { type: Number, default: null }, // Alias for backward compatibility
    aiScore: { type: Number, default: null },
    decision: {
      type: String,
      default: 'PENDING_MANUAL_REVIEW',
    },
    verdict: {
      type: String,
      default: 'PENDING_MANUAL_REVIEW',
    },
    recommendation: {
      type: String,
      default: 'PENDING_MANUAL_REVIEW',
    },
    status: {
      type: String,
      default: 'PROCESSING',
    },
    freshnessScore: { type: Number, default: null },
    colorUniformityScore: { type: Number, default: null },
    blemishFreeScore: { type: Number, default: null },
    firmnessVisualScore: { type: Number, default: null },
    visualObservations: [{ type: String }],
    observations: [{ type: String }],
    defects: [{ type: String }],
    grade: { type: String, default: 'Standard' },
    qualityFactors: {
      freshness: { type: Number, default: 0 },
      appearance: { type: Number, default: 0 },
      damage: { type: Number, default: 0 },
      disease: { type: Number, default: 0 },
      cleanliness: { type: Number, default: 0 },
      uniformity: { type: Number, default: 0 },
    },
    parameters: {
      freshness: { type: Number, default: null },
      colorUniformity: { type: Number, default: null },
      visibleDefects: { type: Number, default: null },
      bruising: { type: Number, default: null },
      fungalRotIndicators: { type: Number, default: null },
      firmnessIndicators: { type: Number, default: null },
      blemishFreeRating: { type: Number, default: null },
      firmnessIndex: { type: Number, default: null },
      maturity: { type: Number, default: null },
      visibleMoistureQuality: { type: Number, default: null },
      defectPercentage: { type: Number, default: null },
      estimatedShelfLifeDays: { type: Number, default: null },
    },
    confidence: { type: Number, default: null },
    defectsDetected: [{ type: String }],
    notes: { type: String, default: '' },
    rejectionReasons: [{ type: String }],
    recommendations: { type: String, default: '' },
    aiAttempts: { type: Number, default: 1 },
    aiError: { type: String, default: null },
    adminReviewRequired: { type: Boolean, default: false },
    adminDecision: { type: String, default: null },
    adminDecisionReason: { type: String, default: null },
    adminReviewedBy: { type: String, default: null },
    adminReviewedAt: { type: Date, default: null },
    farmerRatingBefore: { type: Number, default: null },
    farmerRatingAfter: { type: Number, default: null },
    ratingPenalty: { type: Number, default: null },
    adminOverride: {
      overridden: { type: Boolean, default: false },
      originalVerdict: { type: String, default: '' },
      newVerdict: { type: String, default: '' },
      reason: { type: String, default: '' },
      adminId: { type: String, default: '' },
      adminName: { type: String, default: '' },
      overriddenAt: { type: Date },
    },
    inspectedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Order Schema (Strict State Machine & Transporter Logistics Lifecycle)
const OrderSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    buyerId: { type: String, required: true },
    buyerName: { type: String, required: true },
    buyerPhone: { type: String, default: '' },
    buyerLocation: { type: String, default: '' },
    buyerCoordinates: {
      lat: { type: Number, default: 17.385 },
      lng: { type: Number, default: 78.4867 },
    },
    structuredBuyerLocation: {
      address: { type: String, default: '' },
      formattedAddress: { type: String, default: '' },
      placeId: { type: String, default: '' },
      latitude: { type: Number },
      longitude: { type: Number },
      city: { type: String, default: '' },
      district: { type: String, default: '' },
      state: { type: String, default: '' },
      country: { type: String, default: 'India' },
    },
    items: [
      {
        produceId: String,
        name: String,
        quantity: Number,
        unit: String,
        pricePerUnit: Number,
        totalPrice: Number,
        farmerId: String,
        farmerName: String,
        farmerLocation: String,
        farmerCoordinates: { lat: Number, lng: Number },
        farmerUpiId: String,
        canManageTransport: Boolean,
      },
    ],
    // Strictly consistent transport mode enums
    transportMode: {
      type: String,
      enum: ['BUYER_TRANSPORT', 'FARMER_TRANSPORT'],
      required: true,
    },
    transportProviderFarmerId: { type: String, default: '' },
    transportProviderFarmerName: { type: String, default: '' },
    transporterId: { type: String, default: '' },
    transporterName: { type: String, default: '' },
    transportDistanceKm: { type: Number, default: 0 },
    // Strict rate rule: transportCost = totalRoadDistanceKm * 15 (Zero arbitrary base fee)
    ratePerKm: { type: Number, default: 15 },
    totalTransportCost: { type: Number, default: 0 },
    buyerTransportShare: { type: Number, default: 0 }, // 50%
    farmersTransportShare: { type: Number, default: 0 }, // 50% divided proportionally
    totalProduceAmount: { type: Number, required: true },
    totalOrderAmount: { type: Number, required: true }, // totalProduceAmount + buyerTransportShare
    // Payment status managed authoritatively by backend payment gateway
    paymentStatus: {
      type: String,
      enum: [
        'PENDING',
        'PAYMENT_PENDING',
        'AUTHORIZED',
        'PAID',
        'PAYMENT_VERIFIED',
        'ESCROW_HELD',
        'ESCROW_PAID', // backward compatibility
        'FAILED',
        'PAYOUT_PENDING',
        'PAYOUT_PROCESSING',
        'PAYOUT_COMPLETED',
        'RELEASED_TO_FARMERS',
        'REFUNDED',
      ],
      default: 'PENDING',
    },
    paymentMethod: { type: String, default: 'RAZORPAY_UPI' },
    razorpayOrderId: { type: String, default: '' },
    razorpayPaymentId: { type: String, default: '' },
    razorpaySignature: { type: String, default: '' },
    escrowHold: { type: Boolean, default: true },
    // Strict order lifecycle states
    status: {
      type: String,
      enum: [
        'CART',
        'ROUTE_CALCULATED',
        'PAYMENT_PENDING',
        'PAYMENT_VERIFIED',
        'ESCROW_HELD',
        'PENDING_FARMER_ACCEPTANCE',
        'ALL_FARMERS_ACCEPTED',
        'CONFIRMED',
        'PICKUP_IN_PROGRESS',
        'CHECKPOINT_QUALITY_VERIFICATION',
        'PICKED_UP',
        'IN_TRANSIT',
        'OUT_FOR_DELIVERY',
        'BUYER_QUALITY_CHECK',
        'DELIVERY_OTP_VERIFIED',
        'COMPLETED',
        'PAYOUT_PROCESSING',
        'PAYOUT_COMPLETED',
        'QUALITY_FAILED',
        'DISPUTED',
        'EMERGENCY_REROUTE',
        'CANCELLED',
        'REFUNDED',
      ],
      default: 'PAYMENT_PENDING',
    },
    farmerAcceptances: [
      {
        farmerId: String,
        farmerName: String,
        accepted: { type: Boolean, default: false },
        acceptedAt: { type: Date },
        rejectedAt: { type: Date },
        reason: { type: String, default: '' },
      },
    ],
    checkpoints: [
      {
        checkpointId: String,
        farmerId: String,
        farmerName: String,
        farmerPhone: String,
        location: String,
        coordinates: { lat: Number, lng: Number },
        itemsCount: Number,
        produceSummary: String,
        quantity: Number,
        unit: String,
        produceId: String,
        status: {
          type: String,
          enum: ['PENDING', 'QUALITY_PASSED', 'QUALITY_FAILED', 'PICKED_UP', 'QUARANTINED', 'REROUTED'],
          default: 'PENDING',
        },
        sampleScanScore: { type: Number, default: 0 },
        sampleScanVideoUrl: { type: String, default: '' },
        pickupOtp: { type: String, default: '' },
        pickupVerifiedAt: { type: Date },
        failureReason: { type: String, default: '' },
        penaltyDeduction: { type: Number, default: 0 },
        temperature: { type: Number },
        humidity: { type: Number },
        visualCondition: { type: String, default: 'GOOD' },
        qualityPassed: { type: Boolean, default: false },
        notes: { type: String, default: '' },
        photoUrl: { type: String, default: '' },
        quarantined: { type: Boolean, default: false },
        secondaryMarketDestination: { type: String, default: '' },
        inspectedAt: { type: Date },
      },
    ],
    deliveryOtp: { type: String, default: '' },
    buyerQualityScore: { type: Number, default: 0 },
    buyerQualityObservations: { type: String, default: '' },
    completedAt: { type: Date },
    feedbackSubmitted: { type: Boolean, default: false },
    farmerFeedbacks: [
      {
        farmerId: String,
        farmerName: String,
        rating: Number,
        comment: String,
        submittedAt: { type: Date, default: Date.now },
      },
    ],
    emergencyReroute: {
      failedFarmerId: String,
      originalFailedFarmerId: String,
      replacementFarmerId: String,
      replacementFarmerName: String,
      originalDistance: Number,
      replacementDistance: Number,
      extraDistanceKm: Number,
      penaltyAmount: Number,
      penaltyChargedToFailedFarmer: Number, // alias
      reason: String,
      timestamp: { type: Date, default: Date.now },
      adminConfirmedAt: Date,
      notes: String,
    },
    farmerPayouts: [
      {
        farmerId: String,
        farmerName: String,
        farmerUpiId: String,
        grossAmount: Number,
        transportDeduction: Number,
        penalty: Number,
        transportContributionEarnings: Number,
        netAmount: Number,
        paymentReference: String,
        status: {
          type: String,
          enum: ['PENDING', 'PROCESSING', 'SUCCESS', 'FAILED'],
          default: 'PENDING',
        },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    routeLegs: [
      {
        from: String,
        to: String,
        distanceKm: Number,
        durationMinutes: Number,
        roadGeometry: [
          {
            lat: Number,
            lng: Number,
          },
        ],
      },
    ],
    actualRoadDistanceMeters: { type: Number, default: 0 },
    actualRoadDistanceKm: { type: Number, default: 0 },
    durationSeconds: { type: Number, default: 0 },
    durationText: { type: String, default: '' },
    ETA: { type: String, default: '' },
    polyline: [
      {
        lat: Number,
        lng: Number,
      },
    ],
    waypoints: { type: Array, default: [] },
    reservedStock: [
      {
        produceId: String,
        quantity: Number,
      },
    ],
    reservedUntil: { type: Date },
    stockFinalized: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Admin-Managed Platform Escrow Bank Account
const AgriNexBankSchema = new mongoose.Schema(
  {
    id: { type: String, default: 'agrinex_main_escrow' },
    bankName: { type: String, default: 'State Bank of India' },
    accountNumber: { type: String, default: '4091827364519' },
    ifsc: { type: String, default: 'SBIN0009999' },
    upiId: { type: String, default: 'agrinex.escrow@sbi' },
    holderName: {
      type: String,
      default: 'AgriNex Escrow Marketplace Clearing Pvt Ltd',
    },
    branch: { type: String, default: 'Amaravati Agri Commercial Branch' },
    escrowBalance: { type: Number, default: 284500 },
    totalDisbursedToFarmers: { type: Number, default: 1450200 },
    lastUpdated: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Dispute & Quality Failure Verification Schema
const DisputeSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    orderId: { type: String, required: true },
    checkpointId: { type: String, default: '' },
    failedFarmerId: { type: String, default: '' },
    failedFarmerName: { type: String, default: '' },
    produceName: { type: String, default: 'Agricultural Consignment' },
    score: { type: Number, default: 0 },
    videoProofUrl: { type: String, default: '' },
    reason: { type: String, required: true },
    disputeType: {
      type: String,
      enum: ['QUALITY_FAIL', 'MISSING_QUANTITY', 'DAMAGED_GOODS', 'TRANSIT_DELAY', 'GENERAL'],
      default: 'QUALITY_FAIL',
    },
    raisedBy: { type: String, default: 'SYSTEM' }, // BUYER, TRANSPORTER, SYSTEM, ADMIN
    raisedById: { type: String, default: '' },
    buyerId: { type: String, default: '' },
    penaltyAmount: { type: Number, default: 0 }, // extraDistanceKm * 15
    suggestedReplacementFarmerId: { type: String, default: '' },
    suggestedReplacementFarmerName: { type: String, default: '' },
    extraDistanceKm: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['OPEN', 'ADMIN_CONFIRMED_REROUTED', 'RESOLVED', 'REJECTED_BY_ADMIN'],
      default: 'OPEN',
    },
    resolutionType: {
      type: String,
      enum: ['PENDING', 'FULL_REFUND_BUYER', 'PARTIAL_REFUND', 'FULL_PAYOUT_FARMER', 'ADMIN_CONFIRMED_REROUTED'],
      default: 'PENDING',
    },
    resolutionNotes: { type: String, default: '' },
    refundAmount: { type: Number, default: 0 },
    payoutAmount: { type: Number, default: 0 },
    resolvedAt: { type: Date },
    rerouteEtaMinutes: { type: Number, default: 35 },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Live Transporter GPS Position History
const TransporterGpsSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true },
    transporterId: { type: String, required: true },
    transporterName: { type: String, default: '' },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    accuracy: { type: Number, default: 5 },
    speed: { type: Number, default: 0 },
    heading: { type: Number, default: 0 },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Historical Dataset & AI Demand Forecasting
const DemandForecastSchema = new mongoose.Schema(
  {
    cropName: { type: String, required: true },
    region: { type: String, required: true },
    historicalPeriod: { type: String, required: true },
    source: { type: String, required: true },
    sourceDate: { type: String, required: true },
    dataPointsCount: { type: Number, default: 52 },
    modelInputs: {
      averageMandiArrivalsTonnes: Number,
      modalPriceMin: Number,
      modalPriceMax: Number,
      weatherPrecipitationMm: Number,
      weatherAvgTempC: Number,
    },
    forecast: {
      expectedDemandTrend: String,
      expectedPriceRange: String,
      expectedYieldPerAcre: String,
      riskLevel: String,
      waterRequirement: String,
      recommendedSowingWindow: String,
      expectedProfitability: String,
      reasons: [{ type: String }],
    },
    confidence: { type: Number, default: 94 },
    isEstimate: { type: Boolean, default: false },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Immutable Audit Logs for Security & Regulatory Compliance
const AuditLogSchema = new mongoose.Schema(
  {
    actor: { type: String, required: true },
    role: { type: String, required: true },
    action: { type: String, required: true },
    entity: { type: String, required: true },
    entityId: { type: String, default: '' },
    reason: { type: String, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Real-Time & Persistent Notifications
const NotificationSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    recipientRole: { type: String, required: true },
    recipientUserId: { type: String, default: '' },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, default: 'INFO' }, // INFO, SUCCESS, WARNING, ERROR, QUALITY_ALERT, ORDER_UPDATE
    orderId: { type: String, default: '' },
    read: { type: Boolean, default: false },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Atomic Inventory Reservation to Prevent Overselling
const InventoryReservationSchema = new mongoose.Schema(
  {
    produceId: { type: String, required: true },
    orderId: { type: String, required: true },
    buyerId: { type: String, required: true },
    quantity: { type: Number, required: true },
    status: {
      type: String,
      enum: ['RESERVED', 'COMMITTED', 'RELEASED'],
      default: 'RESERVED',
    },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// Real Market Data Ingestion Record (Agmarknet & APMC Datasets)
const MarketDataSchema = new mongoose.Schema(
  {
    source: { type: String, required: true },
    url: { type: String, default: '' },
    crop: { type: String, required: true },
    market: { type: String, required: true },
    date: { type: String, required: true },
    price: { type: Number, required: true },
    arrivals: { type: Number, default: 0 },
    units: { type: String, default: '₹/Quintal' },
    fetchedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Farmer Personalized Crop Advisory & AI Recommendations
const CropRecommendationSchema = new mongoose.Schema(
  {
    farmerId: { type: String, required: true },
    crop: { type: String, required: true },
    expectedDemand: { type: String, required: true },
    supportingHistoricalData: { type: String, required: true },
    reasoning: { type: String, required: true },
    confidence: { type: Number, default: 92 },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// System Settings & Configuration (Managed by Admin)
const SystemSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: 'global_settings' },
    transportRatePerKm: { type: Number, default: 15 },
    minQualityThreshold: { type: Number, default: 70 },
    otpSimulatorEnabled: { type: Boolean, default: true },
    escrowBankName: { type: String, default: 'State Bank of India' },
    escrowAccountNumber: { type: String, default: '4091827364519' },
    escrowIfsc: { type: String, default: 'SBIN0009999' },
    escrowUpiId: { type: String, default: 'agrinex.escrow@sbi' },
    updatedBy: { type: String, default: 'System' },
    changeHistory: [
      {
        changedBy: String,
        changedAt: { type: Date, default: Date.now },
        oldValues: mongoose.Schema.Types.Mixed,
        newValues: mongoose.Schema.Types.Mixed,
      },
    ],
  },
  { timestamps: true }
);

// Persistent OTP Session Record
const OtpSessionSchema = new mongoose.Schema(
  {
    phoneNumber: { type: String, required: true },
    hashedCode: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attemptsRemaining: { type: Number, default: 3 },
    resendAvailableAt: { type: Date, required: true },
    verified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Performance & Query Optimization Indexes
UserSchema.index({ phone: 1 });
UserSchema.index({ role: 1, verified: 1 });
ProduceSchema.index({ farmerId: 1 });
ProduceSchema.index({ aiQualityScore: 1, aiQualityVerdict: 1, availableQuantity: 1 });
OrderSchema.index({ buyerId: 1, createdAt: -1 });
OrderSchema.index({ status: 1, paymentStatus: 1 });
OrderSchema.index({ 'checkpoints.farmerId': 1 });
QualityInspectionSchema.index({ farmerId: 1, createdAt: -1 });
QualityInspectionSchema.index({ verdict: 1, decision: 1 });
TransporterGpsSchema.index({ orderId: 1, timestamp: -1 });
DisputeSchema.index({ orderId: 1, status: 1 });
AuditLogSchema.index({ timestamp: -1, action: 1 });
NotificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
MarketDataSchema.index({ commodity: 1, date: -1 });

export const UserModel = mongoose.models.User || mongoose.model('User', UserSchema);
export const ProduceModel = mongoose.models.Produce || mongoose.model('Produce', ProduceSchema);
export const OrderModel = mongoose.models.Order || mongoose.model('Order', OrderSchema);
export const QualityInspectionModel =
  mongoose.models.QualityInspection ||
  mongoose.model('QualityInspection', QualityInspectionSchema);
export const AgriNexBankModel =
  mongoose.models.AgriNexBank || mongoose.model('AgriNexBank', AgriNexBankSchema);
export const DisputeModel =
  mongoose.models.Dispute || mongoose.model('Dispute', DisputeSchema);
export const TransporterGpsModel =
  mongoose.models.TransporterGps || mongoose.model('TransporterGps', TransporterGpsSchema);
export const DemandForecastModel =
  mongoose.models.DemandForecast || mongoose.model('DemandForecast', DemandForecastSchema);
export const AuditLogModel =
  mongoose.models.AuditLog || mongoose.model('AuditLog', AuditLogSchema);
export const NotificationModel =
  mongoose.models.Notification || mongoose.model('Notification', NotificationSchema);
export const InventoryReservationModel =
  mongoose.models.InventoryReservation ||
  mongoose.model('InventoryReservation', InventoryReservationSchema);
export const MarketDataModel =
  mongoose.models.MarketData || mongoose.model('MarketData', MarketDataSchema);
export const CropRecommendationModel =
  mongoose.models.CropRecommendation ||
  mongoose.model('CropRecommendation', CropRecommendationSchema);
export const SystemSettingsModel =
  mongoose.models.SystemSettings || mongoose.model('SystemSettings', SystemSettingsSchema);
export const OtpSessionModel =
  mongoose.models.OtpSession || mongoose.model('OtpSession', OtpSessionSchema);

// Additional Production Entities & Aliases (Phase 6)
export const ProductModel = ProduceModel;
export const InventoryModel = ProduceModel;
export const ForecastModel = DemandForecastModel;

// Schemas for specialized operational entities
const PaymentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  orderId: { type: String, required: true },
  buyerId: { type: String, required: true },
  amount: { type: Number, required: true },
  razorpayOrderId: { type: String },
  razorpayPaymentId: { type: String },
  status: { type: String, enum: ['PAYMENT_PENDING', 'PAYMENT_CONFIRMED', 'PAYMENT_FAILED', 'REFUNDED'], default: 'PAYMENT_PENDING' },
  signatureVerified: { type: Boolean, default: false },
  webhookVerified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});
PaymentSchema.index({ orderId: 1, status: 1 });
export const PaymentModel = mongoose.models.Payment || mongoose.model('Payment', PaymentSchema);

const PayoutSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  orderId: { type: String, required: true },
  farmerId: { type: String, required: true },
  farmerName: { type: String, required: true },
  farmerUpiId: { type: String },
  grossProduceAmount: { type: Number, required: true },
  transportDeduction: { type: Number, default: 0 },
  netAmount: { type: Number, required: true },
  status: { type: String, enum: ['PAYOUT_PENDING', 'PAYOUT_PROCESSING', 'PAYOUT_COMPLETED', 'PAYOUT_FAILED'], default: 'PAYOUT_PENDING' },
  payoutReference: { type: String },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now },
});
PayoutSchema.index({ orderId: 1, farmerId: 1 });
export const PayoutModel = mongoose.models.Payout || mongoose.model('Payout', PayoutSchema);

const RatingSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  orderId: { type: String, required: true },
  ratedUserId: { type: String, required: true },
  raterUserId: { type: String, required: true },
  score: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String },
  type: { type: String, enum: ['FARMER_QUALITY', 'TRANSPORTER_SPEED', 'BUYER_RELIABILITY'], default: 'FARMER_QUALITY' },
  createdAt: { type: Date, default: Date.now },
});
RatingSchema.index({ ratedUserId: 1, orderId: 1 }, { unique: true });
export const RatingModel = mongoose.models.Rating || mongoose.model('Rating', RatingSchema);

const RouteSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  orderId: { type: String, required: true },
  transportMode: { type: String, enum: ['BUYER_TRANSPORT', 'FARMER_TRANSPORT'], required: true },
  totalDistanceKm: { type: Number, required: true },
  durationMinutes: { type: Number, required: true },
  ratePerKm: { type: Number, default: 15 },
  totalTransportCost: { type: Number, required: true },
  buyerTransportShare: { type: Number, required: true },
  farmersTransportShare: { type: Number, required: true },
  waypoints: { type: Array, default: [] },
  createdAt: { type: Date, default: Date.now },
});
RouteSchema.index({ orderId: 1 });
export const RouteModel = mongoose.models.Route || mongoose.model('Route', RouteSchema);

const EmergencyReplacementSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  orderId: { type: String, required: true },
  failedFarmerId: { type: String, required: true },
  replacementFarmerId: { type: String, required: true },
  missingQuantity: { type: Number, required: true },
  originalDistanceKm: { type: Number, required: true },
  newTotalDistanceKm: { type: Number, required: true },
  extraDistanceKm: { type: Number, required: true },
  penaltyAmount: { type: Number, required: true }, // extraDistanceKm * 15
  adminNotes: { type: String },
  timestamp: { type: Date, default: Date.now },
});
EmergencyReplacementSchema.index({ orderId: 1, timestamp: -1 });
export const EmergencyReplacementModel =
  mongoose.models.EmergencyReplacement || mongoose.model('EmergencyReplacement', EmergencyReplacementSchema);

export const FarmerModel = UserModel;
export const BuyerModel = UserModel;
export const TransportAssignmentModel = TransporterGpsModel;
export const DeliveryCheckpointModel = QualityInspectionModel;
export const OrderItemModel = ProduceModel;
