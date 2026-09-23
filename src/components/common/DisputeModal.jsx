import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { X, AlertTriangle, ShieldAlert, Upload, CheckCircle2 } from 'lucide-react';

export const DisputeModal = ({ order, onClose }) => {
  const { raiseDispute } = useApp();

  const [reason, setReason] = useState('Quality mismatch');
  const [description, setDescription] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [photos, setPhotos] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  if (!order) return null;

  const handleAddPhoto = () => {
    if (photoUrl.trim()) {
      setPhotos((prev) => [...prev, photoUrl.trim()]);
      setPhotoUrl('');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!description.trim()) return;

    setSubmitting(true);
    raiseDispute({
      orderId: order.id,
      reason,
      description,
      evidencePhotos: photos.length > 0 ? photos : [order.items[0]?.image],
    });
    setSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-stone-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 bg-red-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 text-red-700 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900">
                Raise Dispute • Order #{order.id}
              </h3>
              <p className="text-xs text-red-700 font-medium">
                Payment funds will be frozen pending Admin weighbridge & quality audit
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-stone-400 hover:text-stone-700 rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {/* Reason */}
          <div>
            <label className="font-bold text-stone-900 block mb-1.5">
              Reason for Dispute
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-stone-300 bg-white text-stone-800 text-xs focus:ring-2 focus:ring-red-500 focus:outline-none"
            >
              <option value="Quality mismatch">Quality mismatch (Grade/Freshness discrepancy)</option>
              <option value="Weight mismatch">Weight discrepancy (Delivered weight &lt; Invoiced weight)</option>
              <option value="Damaged goods">Physical damage / Crushed during transit</option>
              <option value="Excessive transit delay">Excessive transit delay leading to spoilage</option>
              <option value="Wrong item delivered">Wrong variety / incorrect produce delivered</option>
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="font-bold text-stone-900 block mb-1.5">
              Detailed Description & Observation
            </label>
            <textarea
              rows={4}
              required
              placeholder="Specify the exact issue observed upon unloading (e.g., dock weighbridge showed 188 kg instead of 200 kg; 10% rotten tubers...)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-stone-300 bg-white text-stone-800 text-xs focus:ring-2 focus:ring-red-500 focus:outline-none"
            />
          </div>

          {/* Photo Evidence */}
          <div>
            <label className="font-bold text-stone-900 block mb-1.5">
              Evidence Photo (Image URL)
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="https://images.unsplash.com/..."
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                className="flex-1 p-2 rounded-xl border border-stone-300 text-xs"
              />
              <button
                type="button"
                onClick={handleAddPhoto}
                className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold rounded-xl"
              >
                Add
              </button>
            </div>
            {photos.length > 0 && (
              <div className="flex gap-2 mt-2">
                {photos.map((p, idx) => (
                  <img
                    key={idx}
                    src={p}
                    alt="Evidence"
                    className="w-12 h-12 rounded-lg object-cover border border-stone-200"
                  />
                ))}
              </div>
            )}
          </div>

          {/* Info notice */}
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              Upon submission, AgriNex Payment settlement status changes to <strong>FROZEN</strong>. Transporter pickup weighbridge receipts and destination inspection photos will be arbitrated by Central Admin.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-stone-300 text-stone-700 hover:bg-stone-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold transition shadow-sm"
            >
              Submit Dispute
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
