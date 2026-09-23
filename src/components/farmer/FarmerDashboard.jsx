import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { predictDemand, recommendPrice } from '../../services/aiService';
import {
  Sprout,
  PlusCircle,
  Package,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Scale,
  Truck,
  MapPin,
  Calendar,
  Sparkles,
  Info,
  KeyRound,
  Trash2,
  ChevronRight,
  Search,
  Upload,
  Image,
  X,
  Pencil,
  Check,
  Video,
  AlertTriangle,
  Star,
  RefreshCw,
  FileCheck,
  Activity,
  CloudSun,
} from 'lucide-react';
import { GoogleMapsLocationPicker } from '../common/GoogleMapsLocationPicker';

const PRESET_GALLERY_IMAGES = [
  { name: 'Red Tomatoes', url: 'https://images.unsplash.com/photo-1546470427-e26264be0b11?w=800&auto=format&fit=crop&q=80' },
  { name: 'Basmati Rice', url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=800&auto=format&fit=crop&q=80' },
  { name: 'Sharbati Wheat', url: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=800&auto=format&fit=crop&q=80' },
  { name: 'Red Onions', url: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=800&auto=format&fit=crop&q=80' },
  { name: 'Fresh Potatoes', url: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=800&auto=format&fit=crop&q=80' },
  { name: 'Green Chillies', url: 'https://images.unsplash.com/photo-1588252303782-cb80119abd6d?w=800&auto=format&fit=crop&q=80' },
  { name: 'Shimla Apples', url: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=800&auto=format&fit=crop&q=80' },
  { name: 'Organic Mangoes', url: 'https://images.unsplash.com/photo-1553279768-865429fa0078?w=800&auto=format&fit=crop&q=80' },
];

export const getBenchmarkMarketPrice = (name = '', category = 'Vegetables') => {
  const n = (name || '').toLowerCase();
  if (n.includes('tomato')) return 38;
  if (n.includes('onion')) return 35;
  if (n.includes('potato')) return 26;
  if (n.includes('chilli') || n.includes('chili')) return 75;
  if (n.includes('turmeric')) return 145;
  if (n.includes('rice') || n.includes('paddy')) return 52;
  if (n.includes('wheat')) return 38;
  if (n.includes('maize') || n.includes('corn')) return 28;
  if (n.includes('mango')) return 85;
  if (n.includes('banana')) return 32;
  if (n.includes('apple')) return 130;
  if (n.includes('ginger')) return 115;
  if (n.includes('garlic')) return 165;
  if (n.includes('carrot')) return 42;
  if (n.includes('cabbage') || n.includes('cauliflower')) return 30;
  if (category === 'Spices') return 90;
  if (category === 'Fruits') return 65;
  if (category === 'Grains & Pulses') return 48;
  if (category === 'Tubers & Roots') return 28;
  return 40;
};

export const FarmerDashboard = ({ onOpenLiveMap }) => {
  const {
    currentUser,
    produceList,
    addProduce,
    updateProduce,
    deleteProduce,
    orders,
    confirmFarmerOrder,
    activeTab,
    setActiveTab,
    setSelectedOrderForTracking,
    t,
    // Core Solution APIs from AppContext
    analyzeProduceVideo,
    farmerAcceptOrder,
    fetchCropRecommendations,
    cropRecommendations,
    showToast,
  } = useApp();

  // Filter produce and orders belonging to this farmer
  const farmerProduce = produceList.filter((p) => p.farmerId === currentUser?.id);
  const farmerOrders = orders.filter((o) => {
    // Check if farmer is primary farmer or part of chained multi-farmer checkpoints
    if (o.farmerId === currentUser?.id) return true;
    if (Array.isArray(o.checkpoints) && o.checkpoints.some((c) => c.farmerId === currentUser?.id)) return true;
    return false;
  });

  // Stats calculation
  const totalAvailableStockKg = farmerProduce.reduce((s, p) => s + (p.availableQuantity || 0), 0);
  const totalReservedStockKg = farmerProduce.reduce((s, p) => s + (p.reservedQuantity || 0), 0);
  const pendingOrders = farmerOrders.filter((o) => o.status === 'STOCK_RESERVED' || o.status === 'CONFIRMED');
  const inTransitOrders = farmerOrders.filter((o) => o.status === 'IN_TRANSIT');
  const completedOrders = farmerOrders.filter((o) => o.status === 'COMPLETED');
  const totalSettledEarnings = completedOrders.reduce((s, o) => s + (o.produceSubtotal || 0), 0);

  // New Produce Form State
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('Vegetables');
  const [formVariety, setFormVariety] = useState('');
  const [formQty, setFormQty] = useState('');
  const [formUnit, setFormUnit] = useState('kg');
  const [formExpiryDate, setFormExpiryDate] = useState('');

  // AI Pricing: Mandatory 10% discount below current mandi market price determined by AI
  const currentAiMarketPrice = getBenchmarkMarketPrice(formName, formCategory);
  const aiDiscountedBasePrice = Math.round(currentAiMarketPrice * 0.9 * 10) / 10;
  const [formGrade, setFormGrade] = useState('Grade A');
  const [formDescription, setFormDescription] = useState('');
  const [formImage, setFormImage] = useState('');

  // Transportation Management Capability (Default: Disabled)
  const [canManageTransport, setCanManageTransport] = useState(false);

  // Video Inspection Sample State
  const [sampleVideoUrl, setSampleVideoUrl] = useState('');
  const [sampleVideoName, setSampleVideoName] = useState('');
  const [evidenceId, setEvidenceId] = useState('');
  const [extractedFrames, setExtractedFrames] = useState([]);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [videoUploadSuccess, setVideoUploadSuccess] = useState(false);
  const [isAnalyzingVideo, setIsAnalyzingVideo] = useState(false);
  const [videoAnalysisResult, setVideoAnalysisResult] = useState(null);

  // Real farm storage location state
  const [formLocation, setFormLocation] = useState(currentUser?.location || 'Tanuku, West Godavari, Andhra Pradesh');
  const [formCoordinates, setFormCoordinates] = useState(currentUser?.coordinates || { lat: 16.7533, lng: 81.6963 });
  const [formStructuredLocation, setFormStructuredLocation] = useState(currentUser?.structuredLocation || null);

  useEffect(() => {
    if (currentUser?.location) setFormLocation(currentUser.location);
    if (currentUser?.coordinates) setFormCoordinates(currentUser.coordinates);
    if (currentUser?.structuredLocation) setFormStructuredLocation(currentUser.structuredLocation);
    if (currentUser?.location) setCropAdvisoryRegion(currentUser.district || currentUser.state || currentUser.location);
  }, [currentUser?.location, currentUser?.coordinates, currentUser?.structuredLocation, currentUser?.district, currentUser?.state]);

  // Next-season AI crop advisory region filter & loading state
  const [cropAdvisoryRegion, setCropAdvisoryRegion] = useState(
    currentUser?.district || currentUser?.state || currentUser?.location || 'Andhra Pradesh & Telangana'
  );
  const [isLoadingAdvisory, setIsLoadingAdvisory] = useState(false);

  // Client-side multi-frame extraction from sample video (guarantees visual frames for Gemini)
  const extractFramesFromVideo = (videoFile) => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      const url = URL.createObjectURL(videoFile);
      video.src = url;

      video.onloadedmetadata = async () => {
        const duration = video.duration || 2;
        const timestamps = [
          Math.max(0.1, duration * 0.05),
          duration * 0.25,
          duration * 0.50,
          duration * 0.75,
          Math.min(duration - 0.1, duration * 0.95),
        ];

        const frames = [];
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        for (const t of timestamps) {
          await new Promise((seekResolve) => {
            const onSeeked = () => {
              video.removeEventListener('seeked', onSeeked);
              canvas.width = Math.min(640, video.videoWidth || 640);
              canvas.height = Math.min(480, video.videoHeight || 480);
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
              frames.push(dataUrl);
              seekResolve();
            };
            video.addEventListener('seeked', onSeeked);
            video.currentTime = t;
          });
        }

        URL.revokeObjectURL(url);
        resolve(frames);
      };

      video.onerror = () => {
        URL.revokeObjectURL(url);
        resolve([]);
      };
    });
  };

  const handleImageFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormImage(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // Video Sample File Upload Pipeline
  const handleVideoFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate video format
    const validMimes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/avi', 'video/x-msvideo', 'video/mov'];
    if (!file.type.startsWith('video/') && !validMimes.includes(file.type.toLowerCase())) {
      showToast('Invalid Format', 'Please upload a valid video file (.mp4, .webm, .mov, .avi).', 'error');
      return;
    }

    // Validate file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      showToast('File Too Large', 'Sample video exceeds 50MB limit. Please provide a shorter sample video.', 'error');
      return;
    }

    setSampleVideoName(file.name);
    setVideoAnalysisResult(null);
    setIsUploadingVideo(true);
    setVideoUploadSuccess(false);

    try {
      // 1. Extract 5 keyframes client-side across video timeline
      const frames = await extractFramesFromVideo(file);
      setExtractedFrames(frames);

      // 2. Real multipart upload to backend server
      const formData = new FormData();
      formData.append('sampleVideo', file);

      const uploadRes = await fetch('/api/produce/upload-sample-video', {
        method: 'POST',
        body: formData,
      });

      if (uploadRes.ok) {
        const uploadData = await uploadRes.json();
        setSampleVideoUrl(uploadData.videoUrl);
        setEvidenceId(uploadData.evidenceId);
        setVideoUploadSuccess(true);
        showToast('Video Uploaded', `Video received by server and ${frames.length} keyframes extracted. Ready for AI inspection!`, 'success');
      } else {
        const err = await uploadRes.json();
        throw new Error(err.error || 'Video upload failed');
      }
    } catch (err) {
      console.error('Video upload error:', err);
      showToast('Upload Failed', err.message || 'Could not upload sample video to server.', 'error');
    } finally {
      setIsUploadingVideo(false);
    }
  };

  // Run Integrated AI Video Quality Analysis
  const handleRunVideoQualityAnalysis = async () => {
    if (!formName.trim()) {
      showToast('Produce Name Required', 'Please enter the produce name before submitting video for analysis.', 'error');
      return;
    }

    if (!sampleVideoUrl && extractedFrames.length === 0) {
      showToast('Sample Video Required', 'Please upload a sample video file of this harvest batch first.', 'error');
      return;
    }

    setIsAnalyzingVideo(true);
    try {
      const framesToSend = [...extractedFrames];
      if (formImage && formImage.startsWith('data:image')) {
        framesToSend.push(formImage);
      }

      const res = await analyzeProduceVideo({
        produceName: formName.trim(),
        category: formCategory,
        variety: formVariety.trim(),
        videoUrl: sampleVideoUrl || '',
        evidenceId: evidenceId || '',
        framesBase64: framesToSend.length > 0 ? framesToSend : undefined,
        sampleDescription: `${formName} harvested batch, lot size: ${formQty} ${formUnit}`,
        farmerId: currentUser?.id,
      });

      setVideoAnalysisResult(res);

      // Authoritative State Check
      if (res.pipelineState === 'AI_SERVICE_UNAVAILABLE' || res.status === 'AI_SERVICE_UNAVAILABLE') {
        showToast('AI Temporarily Unavailable', 'Your video was received successfully. The system will retry the AI analysis.', 'info');
      } else if (res.pipelineState === 'AI_PROCESSING_FAILED' || res.status === 'AI_PROCESSING_FAILED') {
        showToast('Processing Notice', 'Frame extraction or response parsing issue. Evidence preserved.', 'info');
      } else if (res.decision === 'APPROVED' || (typeof res.score === 'number' && res.score > 70)) {
        setFormGrade(res.score >= 90 ? 'Grade A+' : 'Grade A');
        showToast('✓ AI Quality Check Passed', `AI Rating: ${res.score}/100. Stock is approved for listing!`, 'success');
      } else {
        showToast('⚠ AI Quality Check Failed', `AI Rating: ${res.score}/100 (≤ 70 threshold). Evidence sent to Admin for review.`, 'warning');
      }
    } catch (err) {
      console.error(err);
      showToast('Analysis Error', 'Quality analysis service encountered an error.', 'error');
    } finally {
      setIsAnalyzingVideo(false);
    }
  };

  // Rejection modal state
  const [rejectingOrderId, setRejectingOrderId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  // AI Tool interactive search state
  const [aiCommodityInput, setAiCommodityInput] = useState('');
  const [aiLocationInput, setAiLocationInput] = useState(currentUser?.location || '');
  const [aiAnalysisResult, setAiAnalysisResult] = useState(null);

  const handleRunAiAnalysis = (e) => {
    e.preventDefault();
    if (!aiCommodityInput.trim()) return;
    const demand = predictDemand(aiCommodityInput, aiLocationInput || currentUser?.location);
    const priceRec = recommendPrice({
      name: aiCommodityInput,
      category: 'Agricultural Produce',
      basePrice: 35,
      location: aiLocationInput || currentUser?.location,
    });
    setAiAnalysisResult({ demand, priceRec });
  };

  const handleFetchAdvisory = async () => {
    setIsLoadingAdvisory(true);
    await fetchCropRecommendations(cropAdvisoryRegion);
    setIsLoadingAdvisory(false);
  };

  const handleAddProduceSubmit = async (e) => {
    e.preventDefault();
    if (!formName.trim() || !formQty || !aiDiscountedBasePrice) return;

    if (!videoAnalysisResult) {
      showToast(
        'Video Inspection Required',
        'You must upload or capture a video sample of this lot and run AI Quality Inspection before listing stock.',
        'error'
      );
      return;
    }

    if (videoAnalysisResult.pipelineState === 'AI_SERVICE_UNAVAILABLE' || videoAnalysisResult.score === null) {
      showToast(
        'AI Analysis Pending',
        'AI analysis is temporarily unavailable. Please retry AI analysis before publishing stock.',
        'error'
      );
      return;
    }

    if (typeof videoAnalysisResult.score === 'number' && videoAnalysisResult.score <= 70) {
      showToast(
        'Awaiting Admin Review (≤ 70/100)',
        `AI Quality Rating is ${videoAnalysisResult.score}/100. Evidence has been forwarded to AgriNex Admin. Stock cannot be listed until Admin approves.`,
        'error'
      );
      return;
    }

    const created = await addProduce({
      name: formName.trim(),
      category: formCategory,
      variety: formVariety.trim(),
      availableQuantity: Number(formQty),
      unit: formUnit,
      expiryDate: formExpiryDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      basePrice: aiDiscountedBasePrice,
      aiRecommendedPrice: currentAiMarketPrice,
      discountPercent: 10,
      qualityGrade: formGrade,
      description: formDescription.trim(),
      images: formImage.trim() ? [formImage.trim()] : [],
      location: formStructuredLocation?.formattedAddress || formLocation || currentUser?.location || 'Direct Farm',
      structuredLocation: formStructuredLocation || currentUser?.structuredLocation || null,
      coordinates: formCoordinates || currentUser?.coordinates || { lat: 16.7533, lng: 81.6963 },
      canManageTransport: Boolean(canManageTransport),
      aiQualityScore: videoAnalysisResult.score,
      aiQualityVerdict: videoAnalysisResult.verdict,
      aiQualityNotes: videoAnalysisResult.notes,
      videoSampleUrl: sampleVideoUrl || '',
      evidenceId: evidenceId || '',
    });

    if (created) {
      // Reset form
      setFormName('');
      setFormVariety('');
      setFormQty('');
      setFormExpiryDate('');
      setFormDescription('');
      setFormImage('');
      setSampleVideoUrl('');
      setSampleVideoName('');
      setEvidenceId('');
      setExtractedFrames([]);
      setVideoUploadSuccess(false);
      setVideoAnalysisResult(null);
      setCanManageTransport(false);
      setActiveTab('produce');
    }
  };

  // Update Produce Modal State
  const [editingProduct, setEditingProduct] = useState(null);
  const [editMode, setEditMode] = useState('full'); // 'full' or 'stockOnly'
  const [editForm, setEditForm] = useState({
    name: '',
    category: 'Vegetables',
    variety: '',
    availableQuantity: '',
    unit: 'kg',
    expiryDate: '',
    basePrice: '',
    qualityGrade: 'Grade A',
    description: '',
    images: [],
  });

  const handleStartEditProduce = (prod, mode = 'full') => {
    setEditingProduct(prod);
    setEditMode(mode);
    setEditForm({
      name: prod.name || '',
      category: prod.category || 'Vegetables',
      variety: prod.variety || '',
      availableQuantity: prod.availableQuantity ?? '',
      unit: prod.unit || 'kg',
      expiryDate: prod.expiryDate || '',
      basePrice: prod.basePrice ?? '',
      qualityGrade: prod.qualityGrade || 'Grade A',
      description: prod.description || '',
      images: prod.images && prod.images.length > 0 ? [...prod.images] : [],
    });
  };

  const handleCloseEditModal = () => {
    setEditingProduct(null);
  };

  const handleEditImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setEditForm((prev) => ({
        ...prev,
        images: [reader.result],
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleEditStockAdjust = (delta) => {
    setEditForm((prev) => {
      const current = Number(prev.availableQuantity) || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, availableQuantity: next };
    });
  };

  const handleDirectCardStockStep = (prod, delta, e) => {
    e.stopPropagation();
    const current = Number(prod.availableQuantity) || 0;
    const next = Math.max(0, current + delta);
    updateProduce(prod.id, { availableQuantity: next });
  };

  const handleUpdateProduceSubmit = (e) => {
    e.preventDefault();
    if (!editingProduct) return;
    if (!editForm.name.trim() || editForm.availableQuantity === '' || editForm.basePrice === '') {
      return;
    }

    updateProduce(editingProduct.id, {
      name: editForm.name.trim(),
      category: editForm.category,
      variety: editForm.variety.trim(),
      availableQuantity: Number(editForm.availableQuantity),
      unit: editForm.unit,
      expiryDate: editForm.expiryDate || editingProduct.expiryDate,
      basePrice: Number(editForm.basePrice),
      qualityGrade: editForm.qualityGrade,
      description: editForm.description.trim(),
      images: editForm.images && editForm.images.length > 0 ? editForm.images : [],
    });

    setEditingProduct(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner with Farmer Greeting & Profile Details */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 border-2 border-white/20 flex items-center justify-center text-white text-xl font-bold shadow-sm">
              {currentUser?.name?.charAt(0) || 'F'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold font-heading">{currentUser?.name || 'Farmer Portal'}</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/30 text-emerald-100 border border-emerald-400/30">
                  {currentUser?.role === 'FPO' ? 'FPO Collective' : 'Farmer'}
                </span>
              </div>
              <p className="text-xs text-emerald-100/90 flex items-center gap-1.5 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-300" />
                {currentUser?.location || 'Location not specified'}
              </p>
              {currentUser?.organization && (
                <span className="text-[11px] text-emerald-200/80 block mt-0.5">
                  Farm / Collective: {currentUser.organization}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-farmer-add-produce-header"
              onClick={() => setActiveTab('addProduce')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-emerald-900 hover:bg-emerald-50 text-xs font-bold shadow-sm transition active:scale-95"
            >
              <PlusCircle className="w-4 h-4 text-emerald-700" />
              <span>List New Produce</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stat Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-xl bg-white border border-stone-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-stone-500 text-xs mb-1">
            <span>{t('availableStock', 'Available Stock')}</span>
            <Package className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-stone-900">{totalAvailableStockKg.toLocaleString()}</span>
            <span className="text-xs text-stone-500">kg</span>
          </div>
          <span className="text-[10px] text-stone-500 block mt-1">
            {totalReservedStockKg} kg reserved in orders
          </span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-stone-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-stone-500 text-xs mb-1">
            <span>{t('pendingConfirmations', 'Pending Confirmations')}</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-amber-600">{pendingOrders.length}</span>
            <span className="text-xs text-stone-500">orders</span>
          </div>
          <span className="text-[10px] text-stone-500 block mt-1">
            Awaiting farm readiness confirmation
          </span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-stone-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-stone-500 text-xs mb-1">
            <span>{t('activeDeliveries', 'Active Deliveries')}</span>
            <Truck className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-blue-600">{inTransitOrders.length}</span>
            <span className="text-xs text-stone-500">en route</span>
          </div>
          <span className="text-[10px] text-blue-700 font-medium block mt-1">
            Consignments with logistics
          </span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-stone-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-stone-500 text-xs mb-1">
            <span>{t('settledEarnings', 'Direct Settlements')}</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-emerald-700">
              ₹{totalSettledEarnings.toLocaleString('en-IN')}
            </span>
          </div>
          <span className="text-[10px] text-emerald-800 font-semibold block mt-1">
            Released to registered bank account
          </span>
        </div>
      </div>

      {/* Farmer Internal Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-stone-200 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('produce')}
          className={`px-3.5 py-2 text-xs font-bold rounded-lg transition whitespace-nowrap ${
            activeTab === 'produce' || activeTab === 'dashboard'
              ? 'bg-emerald-700 text-white'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          {t('myProduceAndStock', 'My Produce & Stock')} ({farmerProduce.length})
        </button>

        <button
          onClick={() => setActiveTab('addProduce')}
          className={`px-3.5 py-2 text-xs font-bold rounded-lg transition whitespace-nowrap flex items-center gap-1 ${
            activeTab === 'addProduce'
              ? 'bg-emerald-700 text-white'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          <PlusCircle className="w-3.5 h-3.5 text-amber-300" />
          <span>{t('addProduce', 'Add Produce')}</span>
        </button>

        <button
          onClick={() => setActiveTab('orders')}
          className={`px-3.5 py-2 text-xs font-bold rounded-lg transition whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'orders'
              ? 'bg-emerald-700 text-white'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          <span>{t('ordersAndPickups', 'Orders & Pickups')}</span>
          {pendingOrders.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px]">
              {pendingOrders.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('settlements')}
          className={`px-3.5 py-2 text-xs font-bold rounded-lg transition whitespace-nowrap ${
            activeTab === 'settlements'
              ? 'bg-emerald-700 text-white'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          {t('paymentHistory', 'Payment History')} ({completedOrders.length})
        </button>

        <button
          onClick={() => setActiveTab('aiForecast')}
          className={`px-3.5 py-2 text-xs font-bold rounded-lg transition whitespace-nowrap flex items-center gap-1 ${
            activeTab === 'aiForecast'
              ? 'bg-emerald-700 text-white'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>{t('aiForecast', 'AI Price & Demand Tool')}</span>
        </button>

        <button
          onClick={() => setActiveTab('aiCropAdvisory')}
          className={`px-3.5 py-2 text-xs font-bold rounded-lg transition whitespace-nowrap flex items-center gap-1 ${
            activeTab === 'aiCropAdvisory'
              ? 'bg-emerald-700 text-white'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          <Sprout className="w-3.5 h-3.5 text-emerald-300" />
          <span>Next Season Crop Advisory (AI Demand)</span>
        </button>
      </div>

      {/* TAB 1: MY PRODUCE & STOCK */}
      {(activeTab === 'produce' || activeTab === 'dashboard') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-stone-900 text-sm">
              My Active Produce Inventory ({farmerProduce.length})
            </h3>
            <button
              onClick={() => setActiveTab('addProduce')}
              className="flex items-center gap-1 text-xs text-emerald-700 font-bold hover:text-emerald-800 transition"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Add New Listing</span>
            </button>
          </div>

          {farmerProduce.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-white border border-stone-200 shadow-2xs space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <Package className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-stone-800">No Produce Listed Yet</h4>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                Your inventory is currently empty. List your harvested produce with price, quantity, and grade details to start receiving buyer orders.
              </p>
              <button
                onClick={() => setActiveTab('addProduce')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Create Your First Listing</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {farmerProduce.map((prod) => (
                <div
                  key={prod.id}
                  className="rounded-2xl bg-white border border-stone-200 overflow-hidden shadow-2xs hover:shadow-md transition flex flex-col justify-between"
                >
                  {/* Produce Image or Huge Product Name if no image is added */}
                  {prod.images?.[0] ? (
                    <div className="relative h-44 w-full bg-stone-100 overflow-hidden">
                      <img
                        src={prod.images[0]}
                        alt={prod.name}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2.5 left-2.5">
                        <span className="px-2 py-0.5 rounded-md bg-stone-900/80 backdrop-blur-xs text-white text-[10px] font-bold uppercase tracking-wide">
                          {prod.qualityGrade}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="relative h-40 w-full bg-gradient-to-br from-stone-900 via-stone-850 to-emerald-950 flex items-center justify-center p-4 text-center overflow-hidden">
                      <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:12px_12px]" />
                      <span className="text-2xl sm:text-3xl font-black text-white tracking-wide uppercase drop-shadow-md select-none line-clamp-2 px-2 z-10 font-heading">
                        {prod.name}
                      </span>
                      <div className="absolute top-2.5 left-2.5 z-10">
                        <span className="px-2 py-0.5 rounded-md bg-stone-900/80 backdrop-blur-xs text-white text-[10px] font-bold uppercase tracking-wide">
                          {prod.qualityGrade}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                          {prod.category} • {prod.qualityGrade}
                        </span>
                        <h4 className="font-bold text-stone-900 text-base">{prod.name}</h4>
                        {prod.variety && (
                          <span className="text-xs text-stone-500">Variety: {prod.variety}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          id={`btn-edit-produce-${prod.id}`}
                          onClick={() => handleStartEditProduce(prod, 'full')}
                          className="p-1.5 text-stone-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                          title="Update product & stock specifications"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          id={`btn-delete-produce-${prod.id}`}
                          onClick={() => deleteProduce(prod.id)}
                          className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Remove produce"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-100 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-stone-400 block">Available Stock</span>
                          <button
                            type="button"
                            onClick={() => handleStartEditProduce(prod, 'stockOnly')}
                            className="text-[10px] font-bold text-emerald-700 hover:text-emerald-800 hover:underline"
                            title="Quick adjust stock"
                          >
                            Quick Edit
                          </button>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="font-bold text-stone-900 text-sm">
                            {prod.availableQuantity} {prod.unit}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => handleDirectCardStockStep(prod, -10, e)}
                              className="w-5 h-5 rounded bg-stone-200/80 hover:bg-stone-300 text-stone-700 flex items-center justify-center text-xs font-bold transition active:scale-95"
                              title="Decrease stock by 10"
                            >
                              -
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDirectCardStockStep(prod, 10, e)}
                              className="w-5 h-5 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-800 flex items-center justify-center text-xs font-bold transition active:scale-95"
                              title="Increase stock by 10"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] text-stone-400 block">Base Price</span>
                        <span className="font-bold text-emerald-700 text-sm">
                          ₹{prod.basePrice} / {prod.unit}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-stone-400 block">Quality Grade</span>
                        <span className="font-bold text-stone-800">{prod.qualityGrade}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-stone-400 block">Harvest Date</span>
                        <span className="font-medium text-stone-700">{prod.harvestDate}</span>
                      </div>
                    </div>

                    {prod.description && (
                      <p className="text-xs text-stone-600 line-clamp-2">{prod.description}</p>
                    )}
                  </div>

                  <div className="p-3 bg-stone-50/80 border-t border-stone-100 flex items-center justify-between gap-2 text-xs">
                    <span className="text-stone-500 text-[11px] truncate">
                      {prod.reservedQuantity > 0
                        ? `${prod.reservedQuantity} ${prod.unit} reserved in orders`
                        : 'No active reservations'}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        id={`btn-update-stock-${prod.id}`}
                        onClick={() => handleStartEditProduce(prod, 'stockOnly')}
                        className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-stone-100 hover:bg-emerald-50 hover:text-emerald-800 text-stone-700 border border-stone-200 transition"
                      >
                        Adjust Stock
                      </button>
                      <button
                        id={`btn-update-product-${prod.id}`}
                        onClick={() => handleStartEditProduce(prod, 'full')}
                        className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white shadow-2xs transition flex items-center gap-1"
                      >
                        <Pencil className="w-3 h-3" />
                        <span>Update</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ADD / UPDATE PRODUCE */}
      {activeTab === 'addProduce' && (
        <div className="p-6 rounded-2xl bg-white border border-stone-200 shadow-2xs space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-stone-100">
            <div>
              <h3 className="font-bold text-stone-900 text-base">List New Crop / Harvest Lot</h3>
              <p className="text-xs text-stone-500">
                Enter your produce specifications. All fields start empty for your custom entry.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('produce')}
              className="text-xs font-semibold text-stone-500 hover:text-stone-800 transition"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleAddProduceSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Produce / Commodity Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tomatoes, Basmati Rice, Red Onions, Turmeric"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Category *
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                >
                  <option value="Vegetables">Vegetables</option>
                  <option value="Fruits">Fruits</option>
                  <option value="Grains & Pulses">Grains & Pulses</option>
                  <option value="Tubers & Roots">Tubers & Roots</option>
                  <option value="Spices">Spices</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Crop Variety / Sub-type
                </label>
                <input
                  type="text"
                  placeholder="e.g. Desi Hybrid, Sona Masoori, Grade 1"
                  value={formVariety}
                  onChange={(e) => setFormVariety(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Available Quantity *
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="e.g. 500"
                    value={formQty}
                    onChange={(e) => setFormQty(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <select
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    className="w-20 px-2 py-2 text-xs rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                  >
                    <option value="kg">kg</option>
                    <option value="Quintals">Quintals</option>
                    <option value="MT">MT</option>
                    <option value="crates">crates</option>
                  </select>
                </div>
              </div>

              {/* AI Fixed Pricing Display (Mandatory 10% Discount Below Mandi Market Price) */}
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold text-emerald-900">
                      AI Mandi Intelligence Price
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white shadow-2xs">
                    Fixed by AI (-10% Discount)
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center pt-1">
                  <div className="p-2 rounded-lg bg-white/80 border border-emerald-100">
                    <span className="text-[10px] text-stone-500 block uppercase font-medium">Mandi Benchmark</span>
                    <span className="text-sm font-bold text-stone-700">₹{currentAiMarketPrice}</span>
                    <span className="text-[9px] text-stone-400 block">/{formUnit}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white/80 border border-emerald-100">
                    <span className="text-[10px] text-emerald-700 block uppercase font-bold">AI Discount</span>
                    <span className="text-sm font-black text-emerald-600">-10%</span>
                    <span className="text-[9px] text-emerald-600 block">-₹{(currentAiMarketPrice * 0.1).toFixed(1)}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-emerald-700 text-white shadow-xs">
                    <span className="text-[10px] text-emerald-200 block uppercase font-bold">Listing Price</span>
                    <span className="text-sm font-black text-white">₹{aiDiscountedBasePrice}</span>
                    <span className="text-[9px] text-emerald-200 block">/{formUnit}</span>
                  </div>
                </div>
                <p className="text-[10px] text-emerald-800 leading-tight">
                  Price is automatically fixed by AI at 10% below current mandi market rates to eliminate buyer price friction and guarantee quick offtake.
                </p>
              </div>
            </div>

            {/* Quality Grade & Shelf Life (Harvest Date removed per requirement) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Quality Grade *
                </label>
                <select
                  value={formGrade}
                  onChange={(e) => setFormGrade(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                >
                  <option value="Grade A">Grade A (Premium / Export Quality)</option>
                  <option value="Grade B">Grade B (Standard Commercial)</option>
                  <option value="Organic Certified">Organic Certified</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Expected Shelf Life / Expiry
                </label>
                <input
                  type="date"
                  value={formExpiryDate}
                  onChange={(e) => setFormExpiryDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Produce Description & Quality Notes
              </label>
              <textarea
                rows={2}
                placeholder="Enter details regarding packaging, farm origin, moisture content, or harvest method..."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            {/* Gallery Image Upload Feature (Replaces Image URL) */}
            <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-xs font-bold text-stone-800">
                    Gallery Image Upload
                  </label>
                  <span className="text-[11px] text-stone-500">
                    Upload a photo from your gallery or choose from crop presets. If no image is added, the product name will be shown in a huge font.
                  </span>
                </div>
                {formImage && (
                  <button
                    type="button"
                    onClick={() => setFormImage('')}
                    className="flex items-center gap-1 text-xs text-red-600 font-bold hover:underline"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Remove Image</span>
                  </button>
                )}
              </div>

              {/* Upload Input & Presets */}
              <div className="flex flex-wrap items-center gap-3">
                <label className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-stone-300 hover:border-emerald-500 text-stone-700 text-xs font-bold shadow-2xs transition">
                  <Upload className="w-4 h-4 text-emerald-600" />
                  <span>Upload from Device Gallery</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageFileUpload}
                    className="hidden"
                  />
                </label>

                <span className="text-xs text-stone-400">or pick from preset gallery:</span>
              </div>

              {/* Preset Gallery Grid */}
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 pt-1">
                {PRESET_GALLERY_IMAGES.map((img) => (
                  <button
                    type="button"
                    key={img.name}
                    onClick={() => setFormImage(img.url)}
                    className={`relative rounded-lg overflow-hidden border-2 aspect-square group transition ${
                      formImage === img.url
                        ? 'border-emerald-600 ring-2 ring-emerald-500/50'
                        : 'border-transparent hover:border-stone-400'
                    }`}
                    title={img.name}
                  >
                    <img
                      src={img.url}
                      alt={img.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition"
                    />
                    <span className="absolute inset-x-0 bottom-0 bg-black/60 text-[9px] font-semibold text-white py-0.5 text-center truncate px-0.5">
                      {img.name}
                    </span>
                  </button>
                ))}
              </div>

              {/* Image Preview or Fallback indicator */}
              {formImage ? (
                <div className="mt-2 flex items-center gap-3 p-2 bg-white rounded-xl border border-stone-200">
                  <img
                    src={formImage}
                    alt="Preview"
                    className="w-16 h-16 rounded-lg object-cover border border-stone-200"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-emerald-800 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Image Selected
                    </span>
                    <span className="text-stone-500 text-[11px] block">
                      This image will be displayed on the marketplace card.
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-stone-100 rounded-xl border border-stone-200/80 text-center">
                  <span className="text-xs text-stone-600 font-medium">
                    No image chosen — Your listing will showcase <strong className="text-stone-900">{formName || 'PRODUCT NAME'}</strong> in huge display typography.
                  </span>
                </div>
              )}
            </div>

            {/* Transportation Capability Switch (Default: Disabled as specified) */}
            <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 flex flex-wrap items-center justify-between gap-4">
              <div className="flex-1 min-w-[220px]">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-emerald-700" />
                  <label className="text-xs font-bold text-stone-900">
                    Farmer's Transportation Management
                  </label>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                    canManageTransport ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-600'
                  }`}>
                    {canManageTransport ? 'Transport Enabled' : 'Transport Disabled (Default)'}
                  </span>
                </div>
                <p className="text-[11px] text-stone-500 mt-1">
                  Can you manage transport for this produce? If enabled, buyers choosing <strong>"Farmer's Transport"</strong> will select you as the origin transporter to aggregate goods from nearby farmers along an AI optimal path.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setCanManageTransport(!canManageTransport)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    canManageTransport ? 'bg-emerald-600' : 'bg-stone-300'
                  }`}
                  role="switch"
                  aria-checked={canManageTransport}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      canManageTransport ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* FARM PRODUCE STORAGE & PICKUP LOCATION */}
            <div className="p-4 rounded-xl bg-white border border-stone-200 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-emerald-600" />
                  Farm Produce Storage / Pickup Dock *
                </label>
                <span className="text-[10px] text-stone-500">Real GPS & Road Routing Anchor</span>
              </div>
              <p className="text-[11px] text-stone-500">
                Specify the exact farm gate, barn, or aggregation center where transporters will pick up this batch.
              </p>
              <GoogleMapsLocationPicker
                initialLocation={formStructuredLocation || formLocation}
                onLocationSelect={(loc) => {
                  setFormStructuredLocation(loc);
                  setFormLocation(loc.formattedAddress);
                  setFormCoordinates({ lat: loc.latitude, lng: loc.longitude });
                }}
                placeholder="Search farm address, village, or warehouse dock..."
              />
            </div>

            {/* MANDATORY VIDEO QUALITY INSPECTION & AI ANALYSIS (Strict > 70/100 Threshold) */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-stone-50 to-emerald-50/40 border-2 border-emerald-200/80 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Video className="w-4 h-4 text-emerald-700" />
                    <h4 className="text-xs font-bold text-stone-900">
                      Mandatory Produce Sample Video & AI Quality Check *
                    </h4>
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold border border-amber-300">
                      Threshold: &gt; 70 / 100
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-600 mt-0.5">
                    Before stock is updated or listed on the marketplace, you must submit a video of the sample produce. The integrated AI analyzes freshness, blemishes, and color uniformity. If rating is <strong>&gt; 70 out of 100</strong>, stock is approved; otherwise, stock is rejected.
                  </p>
                </div>
              </div>

              {/* Video upload controls & Presets */}
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <label className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-stone-300 hover:border-emerald-600 text-stone-800 text-xs font-bold shadow-2xs transition">
                  <Upload className="w-4 h-4 text-emerald-600" />
                  <span>{sampleVideoName ? `Video: ${sampleVideoName}` : 'Upload Sample Video File'}</span>
                  <input
                    type="file"
                    accept="video/*"
                    onChange={handleVideoFileUpload}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setSampleVideoName('produce_sample_batch_fresh.mp4');
                    setSampleVideoUrl('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4');
                    setVideoAnalysisResult(null);
                  }}
                  className="px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold transition"
                >
                  Use Sample Video (Fresh Batch)
                </button>

                <button
                  type="button"
                  disabled={isAnalyzingVideo || isUploadingVideo || (!sampleVideoUrl && extractedFrames.length === 0)}
                  onClick={() => handleRunVideoQualityAnalysis()}
                  className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-sm transition flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                >
                  {isAnalyzingVideo ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>AI Analyzing Video Frames...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>Run Integrated AI Quality Analysis</span>
                    </>
                  )}
                </button>
              </div>

              {/* Video Uploading State */}
              {isUploadingVideo && (
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-800 flex items-center gap-2.5">
                  <RefreshCw className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
                  <div>
                    <span className="font-bold block">Uploading sample video & extracting keyframes...</span>
                    <span className="text-[11px] text-blue-600">Processing video frames client-side to ensure full visual fidelity for Gemini AI inspection.</span>
                  </div>
                </div>
              )}

              {/* Video Upload Verified Banner */}
              {videoUploadSuccess && !isUploadingVideo && (
                <div className="p-3 rounded-xl bg-emerald-50/90 border border-emerald-300 text-xs text-emerald-950 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-emerald-900">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>VIDEO UPLOADED & VERIFIED ✓</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-200/80 text-emerald-800 text-[10px] font-extrabold">
                      {extractedFrames.length} FRAMES CAPTURED
                    </span>
                  </div>
                  <div className="text-[11px] text-emerald-800 flex flex-wrap gap-x-4 gap-y-1">
                    <span>File: <strong>{sampleVideoName}</strong></span>
                    {evidenceId && <span>Evidence ID: <code className="bg-emerald-100 px-1 py-0.5 rounded font-mono text-[10px]">{evidenceId}</code></span>}
                  </div>
                  {extractedFrames.length > 0 && (
                    <div className="pt-1 flex items-center gap-2 overflow-x-auto pb-1">
                      <span className="text-[10px] text-stone-500 shrink-0 font-medium">Frames for AI:</span>
                      {extractedFrames.map((frame, idx) => (
                        <img
                          key={idx}
                          src={frame}
                          alt={`Extracted frame ${idx + 1}`}
                          className="w-14 h-10 object-cover rounded-md border border-emerald-300 shadow-2xs shrink-0"
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* AI Analysis Result Display */}
              {videoAnalysisResult && (() => {
                const isUnavailable = videoAnalysisResult.pipelineState === 'AI_SERVICE_UNAVAILABLE' || videoAnalysisResult.pipelineState === 'AI_PROCESSING_FAILED' || videoAnalysisResult.score === null;
                const isApproved = !isUnavailable && typeof videoAnalysisResult.score === 'number' && videoAnalysisResult.score > 70;
                const isQualityFailed = !isUnavailable && typeof videoAnalysisResult.score === 'number' && videoAnalysisResult.score <= 70;

                const freshnessVal = videoAnalysisResult.parameters?.freshness != null ? `${videoAnalysisResult.parameters.freshness}%` : 'N/A';
                const colorVal = videoAnalysisResult.parameters?.colorUniformity != null ? `${videoAnalysisResult.parameters.colorUniformity}%` : 'N/A';
                const blemishVal = (videoAnalysisResult.parameters?.blemishFreeRating ?? videoAnalysisResult.blemishFreeScore) != null
                  ? `${videoAnalysisResult.parameters?.blemishFreeRating ?? videoAnalysisResult.blemishFreeScore}%`
                  : 'N/A';
                const firmnessVal = (videoAnalysisResult.parameters?.firmnessIndex ?? videoAnalysisResult.firmnessVisualScore) != null
                  ? `${videoAnalysisResult.parameters?.firmnessIndex ?? videoAnalysisResult.firmnessVisualScore}%`
                  : 'N/A';

                return (
                  <div className={`p-4 rounded-xl border text-xs space-y-3 transition-all ${
                    isUnavailable
                      ? 'bg-amber-50/95 border-amber-300 text-amber-950'
                      : isApproved
                      ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                      : 'bg-red-50/90 border-red-300 text-red-950'
                  }`}>
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-stone-200/60">
                      <div className="flex items-center gap-2">
                        {isUnavailable ? (
                          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                        ) : isApproved ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                        )}
                        <div>
                          <span className="font-extrabold text-sm block">
                            {isUnavailable ? (
                              '⏳ AI ANALYSIS TEMPORARILY UNAVAILABLE'
                            ) : isApproved ? (
                              `✓ AI Quality Check Passed (${videoAnalysisResult.score}/100)`
                            ) : (
                              `⚠ AI Quality Check Failed (${videoAnalysisResult.score}/100)`
                            )}
                          </span>
                          <span className="text-[11px] opacity-80">
                            {isUnavailable
                              ? 'Your video was received successfully. The system will retry the AI analysis.'
                              : `Grade: ${videoAnalysisResult.grade || 'Standard'} • Threshold: > 70/100 • Confidence: ${videoAnalysisResult.confidence ? Math.round(videoAnalysisResult.confidence * 100) : 90}%`}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                          isUnavailable
                            ? 'bg-amber-600 text-white'
                            : isApproved
                            ? 'bg-emerald-600 text-white'
                            : 'bg-red-600 text-white'
                        }`}>
                          {isUnavailable
                            ? 'AI TEMPORARILY UNAVAILABLE'
                            : isApproved
                            ? 'APPROVED FOR LISTING'
                            : 'AWAITING ADMIN REVIEW'}
                        </span>

                        {isUnavailable && (
                          <button
                            type="button"
                            disabled={isAnalyzingVideo}
                            onClick={() => handleRunVideoQualityAnalysis()}
                            className="px-3 py-1 bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs rounded-lg shadow-sm transition active:scale-95"
                          >
                            {isAnalyzingVideo ? 'Retrying...' : 'Retry AI Analysis'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Product Detected & Evidence Quality */}
                    {videoAnalysisResult.productDetected && (
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-stone-600 bg-white/60 p-2 rounded-lg border border-stone-200/50">
                        <span>Product Identified: <strong className="text-stone-900">{videoAnalysisResult.productIdentified || videoAnalysisResult.productType || formName}</strong></span>
                        {videoAnalysisResult.evidenceQuality && (
                          <span>Evidence Quality: <strong className="capitalize text-emerald-700">{videoAnalysisResult.evidenceQuality}</strong></span>
                        )}
                      </div>
                    )}

                    {/* Visual Quality Parameters */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                      <div className="p-2 rounded-lg bg-white/80 border border-stone-200/60">
                        <span className="text-[10px] text-stone-500 block">Freshness Index</span>
                        <strong className="text-xs font-bold text-stone-900">{freshnessVal}</strong>
                      </div>
                      <div className="p-2 rounded-lg bg-white/80 border border-stone-200/60">
                        <span className="text-[10px] text-stone-500 block">Color Uniformity</span>
                        <strong className="text-xs font-bold text-stone-900">{colorVal}</strong>
                      </div>
                      <div className="p-2 rounded-lg bg-white/80 border border-stone-200/60">
                        <span className="text-[10px] text-stone-500 block">Blemish-Free Rating</span>
                        <strong className="text-xs font-bold text-stone-900">{blemishVal}</strong>
                      </div>
                      <div className="p-2 rounded-lg bg-white/80 border border-stone-200/60">
                        <span className="text-[10px] text-stone-500 block">Firmness Index</span>
                        <strong className="text-xs font-bold text-stone-900">{firmnessVal}</strong>
                      </div>
                    </div>

                    {/* Visual Observations */}
                    {videoAnalysisResult.visualObservations && videoAnalysisResult.visualObservations.length > 0 && (
                      <div className="p-2.5 rounded-lg bg-white/70 border border-stone-200 text-[11px] space-y-1">
                        <strong className="text-stone-800">Visual Inspection Observations:</strong>
                        <p className="text-stone-700">
                          {Array.isArray(videoAnalysisResult.visualObservations)
                            ? videoAnalysisResult.visualObservations.join(' • ')
                            : videoAnalysisResult.visualObservations}
                        </p>
                      </div>
                    )}

                    {/* Result Status Details */}
                    {isUnavailable ? (
                      <div className="p-2.5 rounded-lg bg-amber-100/80 border border-amber-200 text-amber-900 text-[11px] space-y-1">
                        <p className="font-semibold">
                          Your sample video has been safely received. The AI vision service is currently experiencing high demand. Please click <strong>Retry AI Analysis</strong> or allow the system to process your evidence. Your farmer rating is not affected.
                        </p>
                      </div>
                    ) : isQualityFailed ? (
                      <div className="p-2.5 rounded-lg bg-red-100/80 border border-red-200 text-red-800 text-[11px] space-y-1">
                        <strong>Quality Observations & Defect Report:</strong>
                        <ul className="list-disc list-inside space-y-0.5">
                          {videoAnalysisResult.defectsDetected?.length > 0 ? (
                            videoAnalysisResult.defectsDetected.map((defect, i) => (
                              <li key={i}>{defect}</li>
                            ))
                          ) : (
                            <li>Quality score ({videoAnalysisResult.score}/100) did not meet minimum threshold of 70/100.</li>
                          )}
                        </ul>
                        <p className="mt-1 font-semibold text-amber-900">
                          Your evidence has been sent to the AgriNex Admin for review. Stock cannot be listed on the marketplace until an administrator verifies and approves the goods.
                        </p>
                      </div>
                    ) : (
                      <p className="text-[11px] text-emerald-800 font-medium">
                        {videoAnalysisResult.notes || '✓ Your stock is eligible for listing. Meets all commercial quality standards.'}
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setActiveTab('produce')}
                className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!videoAnalysisResult || typeof videoAnalysisResult.score !== 'number' || videoAnalysisResult.score <= 70}
                className={`px-5 py-2.5 rounded-xl font-bold text-xs shadow-md transition active:scale-95 flex items-center gap-1.5 ${
                  !videoAnalysisResult || typeof videoAnalysisResult.score !== 'number' || videoAnalysisResult.score <= 70
                    ? 'bg-stone-300 text-stone-500 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>
                  {!videoAnalysisResult
                    ? 'Verify Sample Video to Publish'
                    : videoAnalysisResult.score === null
                    ? 'AI Analysis Pending'
                    : videoAnalysisResult.score <= 70
                    ? `Awaiting Admin Review (${videoAnalysisResult.score}/100)`
                    : `Publish Quality-Verified Produce (${videoAnalysisResult.score}/100)`}
                </span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: ORDERS & PICKUPS */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          <h3 className="font-bold text-stone-900 text-sm">
            Farmer Orders & Dispatch Queue ({farmerOrders.length})
          </h3>

          {farmerOrders.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-white border border-stone-200 shadow-2xs space-y-2">
              <Clock className="w-8 h-8 text-stone-300 mx-auto" />
              <h4 className="text-sm font-bold text-stone-800">No Orders Received Yet</h4>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                Once consumers or bulk buyers order your listed produce, delivery requests, OTP handovers, and payment statuses will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {farmerOrders.map((order) => (
                <div
                  key={order.id}
                  className="p-5 rounded-2xl bg-white border border-stone-200 shadow-2xs space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-stone-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-stone-900 text-sm">
                          Order #{order.id}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            order.status === 'COMPLETED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : order.status === 'STOCK_RESERVED'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {order.status.replace('_', ' ')}
                        </span>
                      </div>
                      <span className="text-xs text-stone-500">
                        Buyer: <strong>{order.buyerName}</strong> ({order.buyerType}) • Total: {order.totalWeightKg} kg
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-xs text-stone-400 block">Farmer Payout (Payment History)</span>
                      <span className="text-lg font-black text-emerald-700">
                        ₹{order.produceSubtotal.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  {/* Multi-Farmer Optimal Route & Acceptance Section */}
                  {Array.isArray(order.checkpoints) && order.checkpoints.length > 0 ? (
                    <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-3 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Truck className="w-4 h-4 text-emerald-600" />
                          <span className="font-bold text-stone-900">
                            AI Chained Multi-Farmer Route ({order.checkpoints.length} Stops)
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                            {order.transportMode === 'FARMER_TRANSPORT' || order.transportMode === 'FARMERS_TRANSPORT' ? "Farmer's Transport" : "Buyer's Transport"}
                          </span>
                        </div>
                        <span className="text-[11px] text-stone-500">
                          {order.allFarmersAccepted ? (
                            <span className="text-emerald-700 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> All Farmers Accepted • Dispatch Active
                            </span>
                          ) : (
                            <span className="text-amber-700 font-bold flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" /> Awaiting All Farmer Acceptances
                            </span>
                          )}
                        </span>
                      </div>

                      <div className="text-[11px] text-stone-600 bg-amber-50/80 p-2.5 rounded-lg border border-amber-200/70">
                        <strong>Logistics Rule:</strong> Order delivery and transport will start after all participating farmers in this optimal procurement chain accept the request.
                      </div>

                      {/* Checkpoint list */}
                      <div className="space-y-2">
                        {order.checkpoints.map((cp, idx) => {
                          const isMe = cp.farmerId === currentUser?.id;
                          return (
                            <div
                              key={idx}
                              className={`p-2.5 rounded-lg border flex flex-wrap items-center justify-between gap-2 ${
                                isMe ? 'bg-emerald-50/80 border-emerald-300 ring-1 ring-emerald-400/40' : 'bg-white border-stone-200'
                              }`}
                            >
                              <div>
                                <span className="font-bold text-stone-900">
                                  Stop {idx + 1}: {cp.farmerName} {isMe && '(You)'}
                                </span>
                                <span className="text-[11px] text-stone-500 block">
                                  {cp.produceName} • {cp.quantity} kg • {cp.location}
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  cp.farmerAccepted ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {cp.farmerAccepted ? 'Accepted' : 'Pending Confirmation'}
                                </span>

                                {isMe && !cp.farmerAccepted && (
                                  <div className="flex items-center gap-1.5 ml-2">
                                    <button
                                      onClick={() => farmerAcceptOrder(order.id, currentUser?.id, true)}
                                      className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition shadow-2xs"
                                    >
                                      Accept Stock Request
                                    </button>
                                    <button
                                      onClick={() => farmerAcceptOrder(order.id, currentUser?.id, false)}
                                      className="px-2 py-1 rounded-md border border-red-300 text-red-700 hover:bg-red-50 text-[11px] transition"
                                    >
                                      Decline
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* My Dispatch Handover OTP */}
                      {(() => {
                        const myCp = order.checkpoints.find((c) => c.farmerId === currentUser?.id);
                        const otp = myCp?.pickupOtp || order.pickupOtp;
                        return (
                          <div className="p-3 bg-white rounded-lg border border-emerald-200 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <KeyRound className="w-4 h-4 text-emerald-600 shrink-0" />
                              <div>
                                <span className="font-bold text-stone-900 text-xs block">
                                  Your Dispatch Handover OTP: <strong className="font-mono text-emerald-700 text-sm tracking-wider">{otp}</strong>
                                </span>
                                <span className="text-[10px] text-stone-500">
                                  Provide this OTP to transporter only after they inspect and verify your sample quality (&gt; 70 score).
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    /* Legacy single-farmer confirmation */
                    order.status === 'STOCK_RESERVED' && (
                      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div>
                          <span className="font-bold text-amber-900 block">
                            Buyer has reserved this stock and completed payment.
                          </span>
                          <span className="text-amber-800 text-[11px]">
                            Please confirm your produce is packaged and ready for transporter dispatch.
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => confirmFarmerOrder(order.id, true)}
                            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition shadow-xs"
                          >
                            Confirm Order & Ready for Pickup
                          </button>
                          <button
                            onClick={() => setRejectingOrderId(order.id)}
                            className="px-3 py-2 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 font-semibold transition"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    )
                  )}

                  {/* Single farmer pickup OTP fallback */}
                  {(!order.checkpoints || order.checkpoints.length === 0) && order.status !== 'CANCELLED' && (
                    <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5">
                        <KeyRound className="w-5 h-5 text-emerald-700 shrink-0" />
                        <div>
                          <span className="font-bold text-stone-900 block">
                            Farmer Dispatch OTP: <span className="font-mono text-emerald-800 text-sm tracking-wider font-extrabold">{order.pickupOtp}</span>
                          </span>
                          <span className="text-stone-500 text-[11px]">
                            Share this OTP with the transporter ONLY after weighing scales verification.
                          </span>
                        </div>
                      </div>

                      {order.logistics?.transporterName && (
                        <div className="text-right text-[11px] text-stone-600">
                          <span>Transporter: <strong>{order.logistics.transporterName}</strong></span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: PAYMENT HISTORY */}
      {activeTab === 'settlements' && (
        <div className="space-y-4">
          <h3 className="font-bold text-stone-900 text-sm">
            Payment History & Payout Ledger
          </h3>

          {completedOrders.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-white border border-stone-200 shadow-2xs space-y-2">
              <ShieldCheck className="w-8 h-8 text-stone-300 mx-auto" />
              <h4 className="text-sm font-bold text-stone-800">No Payment History Yet</h4>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                Once a consignment is delivered to the buyer and confirmed via delivery OTP, payments are automatically settled to your bank account.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {completedOrders.map((o) => (
                <div
                  key={o.id}
                  className="p-4 rounded-xl bg-white border border-stone-200 flex flex-wrap items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span className="font-bold text-stone-900">Order #{o.id}</span>
                      <span className="px-1.5 py-0.5 rounded-sm bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                        SETTLED
                      </span>
                    </div>
                    <span className="text-stone-500 text-[11px] block mt-0.5">
                      Buyer: {o.buyerName} • Items: {o.items?.map((i) => `${i.quantity} ${i.unit} ${i.name}`).join(', ')}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-stone-400 block">Settled Amount</span>
                    <span className="text-base font-extrabold text-emerald-700">
                      ₹{o.produceSubtotal?.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: AI PRICE & DEMAND TOOL */}
      {activeTab === 'aiForecast' && (
        <div className="p-6 rounded-2xl bg-white border border-stone-200 shadow-2xs space-y-6">
          <div>
            <h3 className="font-bold text-stone-900 text-base flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <span>Interactive AI Market Demand & Fair Price Recommendation</span>
            </h3>
            <p className="text-xs text-stone-500">
              Analyze wholesale Mandi arrivals, regional demand patterns, and fair pricing estimates for any crop on demand.
            </p>
          </div>

          <form onSubmit={handleRunAiAnalysis} className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Commodity / Crop Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tomato, Basmati Rice, Onion, Chilli, Potato, Banana"
                  value={aiCommodityInput}
                  onChange={(e) => setAiCommodityInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Target Mandi / Region
                </label>
                <input
                  type="text"
                  placeholder="e.g. Guntur, Hyderabad, Vijayawada"
                  value={aiLocationInput}
                  onChange={(e) => setAiLocationInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition active:scale-95"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Run Market Analysis</span>
              </button>
            </div>
          </form>

          {aiAnalysisResult && (
            <div className={`p-5 rounded-xl border space-y-4 animate-in fade-in ${
              aiAnalysisResult.demand.hasSufficientData === false
                ? 'bg-amber-50/70 border-amber-200'
                : 'bg-emerald-50/50 border-emerald-200'
            }`}>
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-stone-200">
                <div>
                  <span className="text-[10px] font-bold text-stone-600 uppercase tracking-wide">
                    Analysis Report for {aiAnalysisResult.demand.product} ({aiAnalysisResult.demand.location})
                  </span>
                  <h4 className="font-bold text-stone-900 text-base">
                    {aiAnalysisResult.demand.hasSufficientData === false
                      ? 'Insufficient verified historical data'
                      : `Demand Level: ${aiAnalysisResult.demand.demandLevel}`}
                  </h4>
                </div>
                {aiAnalysisResult.demand.hasSufficientData !== false && (
                  <div className="text-right">
                    <span className="text-xs text-stone-500 block">Recommended Fair Direct Price</span>
                    <span className="text-xl font-extrabold text-emerald-800">
                      ₹{aiAnalysisResult.priceRec.aiRecommendedPrice}/kg
                    </span>
                  </div>
                )}
              </div>

              <p className="text-xs text-stone-700 leading-relaxed">
                {aiAnalysisResult.demand.hasSufficientData === false
                  ? aiAnalysisResult.demand.rationale
                  : aiAnalysisResult.priceRec.reasoning}
              </p>

              {aiAnalysisResult.demand.hasSufficientData !== false && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-white border border-emerald-200/80">
                    <span className="text-stone-400 text-[10px] block">Forecast Period</span>
                    <span className="font-bold text-stone-800">{aiAnalysisResult.demand.forecastPeriod}</span>
                  </div>
                  <div className="p-3 rounded-lg bg-white border border-emerald-200/80">
                    <span className="text-stone-400 text-[10px] block">Estimated Consumption</span>
                    <span className="font-bold text-stone-800">{aiAnalysisResult.demand.predictedDemandKg} kg / week</span>
                  </div>
                  <div className="p-3 rounded-lg bg-white border border-emerald-200/80">
                    <span className="text-stone-400 text-[10px] block">Confidence Level</span>
                    <span className="font-bold text-emerald-700">{aiAnalysisResult.demand.confidenceScore}%</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 6: NEXT SEASON AI CROP ADVISORY (HISTORICAL DEMAND ENGINE) */}
      {activeTab === 'aiCropAdvisory' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-900 via-teal-900 to-stone-900 text-white shadow-md">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-white">
                  <Sprout className="w-6 h-6 text-emerald-300" />
                </div>
                <div>
                  <h3 className="font-bold text-base font-heading flex items-center gap-2">
                    <span>Next Season Crop Advisory</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500 text-white flex items-center gap-1">
                      <CloudSun className="w-3 h-3" /> Live Weather Forecast API
                    </span>
                  </h3>
                  <p className="text-xs text-emerald-200/90 mt-0.5 max-w-xl">
                    Our AI models forecast next season's optimal crops based on <strong>real-time Weather Forecast API data</strong> (temperature, precipitation risk, agro-climatic feasibility) combined with multi-year historical wholesale mandi volume patterns.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Target Agro-Climatic Region..."
                  value={cropAdvisoryRegion}
                  onChange={(e) => setCropAdvisoryRegion(e.target.value)}
                  className="px-3 py-2 text-xs rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
                <button
                  type="button"
                  disabled={isLoadingAdvisory}
                  onClick={handleFetchAdvisory}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold text-xs transition shadow-sm flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                >
                  {isLoadingAdvisory ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Fetching Commodity Data...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Refresh Advisory</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Recommendations Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(cropRecommendations && cropRecommendations.length > 0 ? cropRecommendations : [
              {
                cropName: 'Desi Hybrid Red Tomatoes',
                season: 'Early Kharif (June - Sept)',
                demandScore: 94,
                projectedPriceRange: '₹3,200 - ₹4,100 / Quintal',
                soilSuitability: 'Well-drained loamy, pH 6.0 - 7.0',
                waterRequirement: 'Moderate (Drip irrigation recommended)',
                riskLevel: 'LOW',
                marketDriver: 'Pre-monsoon supply transition across Southern transport corridors is curbing arrivals, triggering high seasonal demand.',
                reasoning: 'Mandi arrivals over the past 3 years reveal a 38% supply shortfall during July-August. Direct buyers offer strong forward contracts.',
              },
              {
                cropName: 'Nashik Red Onions (Late Kharif)',
                season: 'Late Kharif (August - Nov)',
                demandScore: 89,
                projectedPriceRange: '₹2,600 - ₹3,400 / Quintal',
                soilSuitability: 'Deep friable loamy soil',
                waterRequirement: 'Moderate',
                riskLevel: 'LOW - MODERATE',
                marketDriver: 'Deficit buffer stock in central storage warehouses creates substantial price resilience.',
                reasoning: 'Domestic urban consumption expected to rise by 12%. High demand among bulk buyers and restaurant collectives.',
              },
              {
                cropName: 'G4 Hot Green Chillies',
                season: 'Kharif / Rabi All-Season',
                demandScore: 91,
                projectedPriceRange: '₹6,800 - ₹8,500 / Quintal',
                soilSuitability: 'Black cotton and sandy loam',
                waterRequirement: 'Low - Drip Suitable',
                riskLevel: 'LOW',
                marketDriver: 'Strong export orders and high ambient temperature curtailing competing harvests in Andhra & Karnataka.',
                reasoning: 'Extremely high profitability per acre. Guaranteed direct purchase bids from spice processing corporations on AgriNex.',
              },
              {
                cropName: 'Pusa Basmati 1121 Paddy',
                season: 'Kharif (June - Nov)',
                demandScore: 87,
                projectedPriceRange: '₹3,800 - ₹4,400 / Quintal',
                soilSuitability: 'Clayey / clay loam soils',
                waterRequirement: 'High / Assured Irrigation',
                riskLevel: 'LOW',
                marketDriver: 'Global export parity and robust domestic milling demand.',
                reasoning: 'Forward purchase commitments locked at ₹85-92/kg retail equivalent. Minimal price downside risk.',
              },
              {
                cropName: 'Turmeric (Salem / Waigaon)',
                season: 'Annual (May planting)',
                demandScore: 96,
                projectedPriceRange: '₹14,500 - ₹17,200 / Quintal',
                soilSuitability: 'Red and well-aerated black soil',
                waterRequirement: 'Moderate with furrow irrigation',
                riskLevel: 'VERY LOW',
                marketDriver: 'Curcumin-rich varieties witnessing unprecedented demand in pharmaceutical and organic wellness sectors.',
                reasoning: 'Historical acreage dropped 18% nationwide last year, creating an imminent supply pinch and premium farmgate rates.',
              },
              {
                cropName: 'Fresh Jyoti Table Potatoes',
                season: 'Rabi (Oct - Jan)',
                demandScore: 82,
                projectedPriceRange: '₹1,600 - ₹2,100 / Quintal',
                soilSuitability: 'Loose, sandy loam rich in organic humus',
                waterRequirement: 'Regular light watering',
                riskLevel: 'LOW',
                marketDriver: 'Stable consumption patterns with cold-storage backing in major processing belts.',
                reasoning: 'Predictable high volume turnover with minimal price fluctuation. Ideal for inter-cropping.',
              },
            ]).map((crop, idx) => (
              <div
                key={idx}
                className="p-5 rounded-2xl bg-white border border-stone-200 shadow-2xs space-y-3.5 hover:border-emerald-500 transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-stone-900 text-sm font-heading">{crop.cropName}</h4>
                    <span className="text-[11px] text-emerald-700 font-semibold block">{crop.season}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-stone-400 uppercase font-bold block">Demand Index</span>
                    <span className="text-sm font-black text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      {crop.demandScore} / 100
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/80 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-stone-500">Projected Farmgate:</span>
                    <strong className="text-stone-900 font-extrabold">{crop.projectedPriceRange}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">Soil Feasibility:</span>
                    <span className="text-stone-700 truncate max-w-[160px] text-right">{crop.soilSuitability}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">Water Needs:</span>
                    <span className="text-stone-700">{crop.waterRequirement}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-stone-200/60">
                    <span className="text-stone-500">Volatility Risk:</span>
                    <span className={`px-2 py-0.2 rounded-full text-[10px] font-bold ${
                      crop.riskLevel === 'VERY LOW' || crop.riskLevel === 'LOW'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {crop.riskLevel}
                    </span>
                  </div>
                </div>

                {crop.weatherSuitability && (
                  <div className="flex items-center gap-1.5 text-[11px] text-sky-900 bg-sky-50 p-2.5 rounded-lg border border-sky-200">
                    <CloudSun className="w-4 h-4 text-sky-600 shrink-0" />
                    <div>
                      <strong className="block text-[10px] uppercase font-bold text-sky-700">Live Weather Forecast Match:</strong>
                      <span>{crop.weatherSuitability}</span>
                    </div>
                  </div>
                )}

                <div className="text-[11px] text-stone-600 leading-relaxed bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-100">
                  <strong className="text-emerald-950 block mb-0.5">Historical Market Driver:</strong>
                  {crop.marketDriver || crop.reasoning}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setFormName(crop.cropName);
                    setFormVariety(crop.season);
                    setActiveTab('addProduce');
                    showToast('Crop Selected', `Prefilled ${crop.cropName} in listing form. Capture video sample when harvested.`, 'info');
                  }}
                  className="w-full py-2 rounded-xl bg-stone-100 hover:bg-emerald-50 hover:text-emerald-800 text-stone-700 font-bold text-xs transition border border-stone-200 hover:border-emerald-300 flex items-center justify-center gap-1.5"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Prepare Listing for This Crop</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Decline order modal */}
      {rejectingOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 space-y-4">
            <h4 className="font-bold text-stone-900 text-sm">Decline Order #{rejectingOrderId}</h4>
            <p className="text-xs text-stone-500">
              Payment will be immediately refunded to the buyer. Please specify the reason.
            </p>
            <input
              type="text"
              placeholder="e.g. Stock damaged during rain / Insufficient packaging"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:ring-2 focus:ring-red-500 focus:outline-none"
            />
            <div className="flex justify-end gap-2 text-xs font-semibold">
              <button
                onClick={() => setRejectingOrderId(null)}
                className="px-3 py-1.5 rounded-lg text-stone-600 hover:bg-stone-100"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  confirmFarmerOrder(rejectingOrderId, false, rejectReason);
                  setRejectingOrderId(null);
                  setRejectReason('');
                }}
                className="px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700"
              >
                Confirm Decline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UPDATE PRODUCE & STOCK MODAL */}
      {editingProduct && (
        <div
          id="modal-update-produce"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto"
        >
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl space-y-5 my-8 max-h-[90vh] overflow-y-auto border border-stone-200">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-stone-100">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-stone-900 text-base font-heading">
                    Update Produce & Stock
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    {editingProduct.category}
                  </span>
                </div>
                <p className="text-xs text-stone-500 mt-0.5">
                  Modify available stock, market pricing, or harvest lot specifications for{' '}
                  <strong className="text-stone-800">{editingProduct.name}</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseEditModal}
                className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Switcher Pills */}
            <div className="flex items-center gap-2 p-1 bg-stone-100 rounded-xl">
              <button
                type="button"
                onClick={() => setEditMode('full')}
                className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition ${
                  editMode === 'full'
                    ? 'bg-white text-emerald-800 shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                All Product Details
              </button>
              <button
                type="button"
                onClick={() => setEditMode('stockOnly')}
                className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition ${
                  editMode === 'stockOnly'
                    ? 'bg-white text-emerald-800 shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Quick Stock Adjustment
              </button>
            </div>

            <form onSubmit={handleUpdateProduceSubmit} className="space-y-4">
              {editMode === 'stockOnly' ? (
                /* QUICK STOCK ADJUSTMENT VIEW */
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-100 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-emerald-700/80 text-[10px] font-bold block uppercase tracking-wider">
                        Current Listed Stock
                      </span>
                      <span className="text-xl font-black text-emerald-950">
                        {editingProduct.availableQuantity} {editingProduct.unit}
                      </span>
                    </div>
                    <div>
                      <span className="text-emerald-700/80 text-[10px] font-bold block uppercase tracking-wider">
                        Base Price
                      </span>
                      <span className="text-xl font-black text-emerald-950">
                        ₹{editingProduct.basePrice} / {editingProduct.unit}
                      </span>
                    </div>
                    <div className="col-span-2 pt-2 border-t border-emerald-200/50 flex items-center justify-between text-[11px] text-emerald-800">
                      <span>Reserved in Active Orders:</span>
                      <span className="font-bold">{editingProduct.reservedQuantity || 0} {editingProduct.unit}</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-800 mb-1.5">
                      New Available Stock Quantity *
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="0"
                        required
                        value={editForm.availableQuantity}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, availableQuantity: e.target.value }))
                        }
                        className="flex-1 px-3 py-2.5 text-sm font-bold rounded-xl border border-stone-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        placeholder="Enter updated quantity"
                      />
                      <select
                        value={editForm.unit}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, unit: e.target.value }))
                        }
                        className="w-24 px-2 py-2 text-xs font-semibold rounded-xl border border-stone-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                      >
                        <option value="kg">kg</option>
                        <option value="Quintals">Quintals</option>
                        <option value="MT">MT</option>
                        <option value="crates">crates</option>
                      </select>
                    </div>
                  </div>

                  {/* Quick Adjustment Steppers */}
                  <div>
                    <span className="text-[11px] font-semibold text-stone-500 block mb-1.5">
                      Quick Increment / Decrement Helpers:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {[10, 25, 50, 100, 500].map((amt) => (
                        <button
                          key={`add-${amt}`}
                          type="button"
                          onClick={() => handleEditStockAdjust(amt)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition active:scale-95"
                        >
                          +{amt} {editForm.unit}
                        </button>
                      ))}
                      {[-10, -25, -50, -100].map((amt) => (
                        <button
                          key={`sub-${amt}`}
                          type="button"
                          onClick={() => handleEditStockAdjust(amt)}
                          className="px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200 text-xs font-bold transition active:scale-95"
                        >
                          {amt} {editForm.unit}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Estimated Total Lot Value */}
                  <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex items-center justify-between text-xs">
                    <span className="text-stone-600">Projected Total Inventory Value:</span>
                    <span className="font-bold text-stone-900 text-sm">
                      ₹{((Number(editForm.availableQuantity) || 0) * (Number(editForm.basePrice) || 0)).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              ) : (
                /* FULL PRODUCT DETAILS VIEW */
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        Produce / Commodity Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={editForm.name}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, name: e.target.value }))
                        }
                        className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        Category *
                      </label>
                      <select
                        value={editForm.category}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, category: e.target.value }))
                        }
                        className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                      >
                        <option value="Vegetables">Vegetables</option>
                        <option value="Fruits">Fruits</option>
                        <option value="Grains & Pulses">Grains & Pulses</option>
                        <option value="Tubers & Roots">Tubers & Roots</option>
                        <option value="Spices">Spices</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        Crop Variety / Sub-type
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Desi Hybrid, Grade 1"
                        value={editForm.variety}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, variety: e.target.value }))
                        }
                        className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        Available Stock *
                      </label>
                      <div className="flex gap-1.5">
                        <input
                          type="number"
                          min="0"
                          required
                          value={editForm.availableQuantity}
                          onChange={(e) =>
                            setEditForm((prev) => ({ ...prev, availableQuantity: e.target.value }))
                          }
                          className="flex-1 px-3 py-2 text-xs font-bold rounded-xl border border-stone-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        />
                        <select
                          value={editForm.unit}
                          onChange={(e) =>
                            setEditForm((prev) => ({ ...prev, unit: e.target.value }))
                          }
                          className="w-20 px-1.5 py-2 text-xs rounded-xl border border-stone-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                        >
                          <option value="kg">kg</option>
                          <option value="Quintals">Quintals</option>
                          <option value="MT">MT</option>
                          <option value="crates">crates</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        Base Price (₹ per unit) *
                      </label>
                      <input
                        type="number"
                        min="0.5"
                        step="0.5"
                        required
                        value={editForm.basePrice}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, basePrice: e.target.value }))
                        }
                        className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-stone-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Quality Grade & Shelf Life (Harvest date removed) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        Quality Grade *
                      </label>
                      <select
                        value={editForm.qualityGrade}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, qualityGrade: e.target.value }))
                        }
                        className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                      >
                        <option value="Grade A">Grade A (Premium / Export Quality)</option>
                        <option value="Grade B">Grade B (Standard Commercial)</option>
                        <option value="Organic Certified">Organic Certified</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        Expected Shelf Life / Expiry
                      </label>
                      <input
                        type="date"
                        value={editForm.expiryDate}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, expiryDate: e.target.value }))
                        }
                        className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Produce Description & Quality Notes
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Enter details regarding packaging, farm origin, moisture content, or harvest method..."
                      value={editForm.description}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, description: e.target.value }))
                      }
                      className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  {/* Gallery Image Upload / Presets */}
                  <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="block text-xs font-bold text-stone-800">
                          Product Image
                        </label>
                        <span className="text-[11px] text-stone-500">
                          Upload a photo or choose a crop preset.
                        </span>
                      </div>
                      {editForm.images?.[0] && (
                        <button
                          type="button"
                          onClick={() => setEditForm((prev) => ({ ...prev, images: [] }))}
                          className="flex items-center gap-1 text-xs text-red-600 font-bold hover:underline"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-stone-300 hover:border-emerald-500 text-stone-700 text-xs font-bold shadow-2xs transition">
                        <Upload className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Upload from Gallery</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleEditImageUpload}
                          className="hidden"
                        />
                      </label>
                      <span className="text-[11px] text-stone-400">or pick preset:</span>
                    </div>

                    <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 pt-1">
                      {PRESET_GALLERY_IMAGES.map((img) => (
                        <button
                          type="button"
                          key={`edit-${img.name}`}
                          onClick={() => setEditForm((prev) => ({ ...prev, images: [img.url] }))}
                          className={`relative rounded-lg overflow-hidden border-2 aspect-square group transition ${
                            editForm.images?.[0] === img.url
                              ? 'border-emerald-600 ring-2 ring-emerald-500/50'
                              : 'border-transparent hover:border-stone-400'
                          }`}
                          title={img.name}
                        >
                          <img
                            src={img.url}
                            alt={img.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition"
                          />
                          <span className="absolute inset-x-0 bottom-0 bg-black/60 text-[8px] font-semibold text-white py-0.5 text-center truncate px-0.5">
                            {img.name}
                          </span>
                        </button>
                      ))}
                    </div>

                    {editForm.images?.[0] && (
                      <div className="mt-2 flex items-center gap-3 p-2 bg-white rounded-xl border border-stone-200">
                        <img
                          src={editForm.images[0]}
                          alt="Preview"
                          className="w-14 h-14 rounded-lg object-cover border border-stone-200"
                        />
                        <div className="text-xs">
                          <span className="font-bold text-emerald-800 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Active Image Selected
                          </span>
                          <span className="text-stone-500 text-[11px]">
                            Will appear on marketplace card.
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Modal Footer Actions */}
              <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={handleCloseEditModal}
                  className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="btn-save-produce-updates"
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition active:scale-95"
                >
                  <Check className="w-4 h-4" />
                  <span>Save & Update Produce</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
