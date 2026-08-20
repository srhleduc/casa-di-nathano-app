"use client";

import { useState } from "react";
import {
  useApproSuppliers,
  useApproProducts,
  insertApproSupplier,
  updateApproSupplier,
  insertApproProduct,
  updateApproProduct,
  insertApproStockMovement,
} from "@/lib/data";

const inputStyle = { background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" };

// Types proposés à la saisie manuelle — "vente" reste dans le schéma pour
// la décrémentation automatique d'une phase ultérieure (recettes liées aux
// ventes), mais n'a pas de sens comme mouvement saisi à la main ici.
const MOVEMENT_TYPES = [
  { key: "achat", label: "📥 Réception", sign: 1 },
  { key: "perte", label: "🗑️ Perte", sign: -1 },
  { key: "retour", label: "↩️ Retour fournisseur", sign: -1 },
  { key: "correction", label: "✏️ Correction d'inventaire", sign: 0 },
];

function MovementModal({ product, suppliers, onClose }) {
  const [movementType, setMovementType] = useState("achat");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [createdBy, setCreatedBy] = useState("");
  const [saving, setSaving] = useState(false);
  const type = MOVEMENT_TYPES.find((t) => t.key === movementType);

  async function save() {
    const qty = parseFloat(quantity.replace(",", "."));
    if (!qty || qty <= 0) return;
    setSaving(true);
    try {
      const signedQty = type.sign === 0 ? qty : qty * type.sign;
      await insertApproStockMovement({ productId: product.id, movementType, quantity: signedQty, reason, createdBy });
      onClose();
    } catch (err) {
      console.error(err);
      alert("Échec de l'enregistrement du mouvement.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
      <div className="w-full md:max-w-md rounded-3xl overflow-hidden" style={{ background: "#1a120b", color: "#f5ebdd" }}>
        <div className="px-6 py-6">
          <div className="font-bold text-lg mb-1">{product.name}</div>
          <div className="text-[#a88f78] text-sm mb-5">
            Stock actuel : {product.currentStock} {product.unit}
          </div>

          <div className="text-xs text-[#a88f78] uppercase font-bold mb-2">Type de mouvement</div>
          <div className="flex flex-wrap gap-2 mb-4">
            {MOVEMENT_TYPES.map((t) => (
              <button
                key={t.key}
                onClick={() => setMovementType(t.key)}
                className={`tap-scale rounded-full px-4 py-2 text-sm font-bold border-2 ${movementType === t.key ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="text-xs text-[#a88f78] uppercase font-bold mb-1">
            Quantité {type.sign !== 0 && `(${product.unit}, positive — le sens est déduit du type)`}
            {type.sign === 0 && `(${product.unit} — positive pour ajouter, négative pour retirer)`}
          </div>
          <input
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            inputMode="decimal"
            placeholder="0"
            className="rounded-lg px-3 py-3 w-full mb-4"
            style={inputStyle}
            autoFocus
          />

          <div className="text-xs text-[#a88f78] uppercase font-bold mb-1">Motif (optionnel)</div>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex. carton abîmé, comptage physique..."
            className="rounded-lg px-3 py-3 w-full mb-4"
            style={inputStyle}
          />

          <div className="text-xs text-[#a88f78] uppercase font-bold mb-1">Saisi par (optionnel)</div>
          <input
            value={createdBy}
            onChange={(e) => setCreatedBy(e.target.value)}
            placeholder="Prénom"
            className="rounded-lg px-3 py-3 w-full mb-6"
            style={inputStyle}
          />

          <div className="flex flex-col gap-3">
            <button onClick={save} disabled={saving} className="tap-scale rounded-full py-4 text-lg font-bold" style={{ background: "#C0392B", color: "#fff5ea" }}>
              Enregistrer
            </button>
            <button onClick={onClose} className="tap-scale rounded-full py-4 text-lg font-bold border-2 border-[#3a2b1f] text-[#c9b8a4]">
              Annuler
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductModal({ product, suppliers, onClose }) {
  const [name, setName] = useState(product?.name || "");
  const [unit, setUnit] = useState(product?.unit || "kg");
  const [primarySupplierId, setPrimarySupplierId] = useState(product?.primarySupplierId || "");
  const [alertThreshold, setAlertThreshold] = useState(product?.alertThreshold ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim() || !unit.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        unit: unit.trim(),
        primarySupplierId: primarySupplierId || null,
        alertThreshold: alertThreshold === "" ? null : parseFloat(String(alertThreshold).replace(",", ".")),
      };
      if (product) await updateApproProduct(product.id, payload);
      else await insertApproProduct(payload);
      onClose();
    } catch (err) {
      console.error(err);
      alert("Échec de l'enregistrement du produit.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
      <div className="w-full md:max-w-md rounded-3xl overflow-hidden" style={{ background: "#1a120b", color: "#f5ebdd" }}>
        <div className="px-6 py-6">
          <div className="font-bold text-lg mb-5">{product ? "Modifier le produit" : "Nouveau produit"}</div>

          <div className="text-xs text-[#a88f78] uppercase font-bold mb-1">Nom</div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Mozzarella Fior di Latte" className="rounded-lg px-3 py-3 w-full mb-4" style={inputStyle} autoFocus />

          <div className="text-xs text-[#a88f78] uppercase font-bold mb-1">Unité</div>
          <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="kg, L, pièce, carton..." className="rounded-lg px-3 py-3 w-full mb-4" style={inputStyle} />

          <div className="text-xs text-[#a88f78] uppercase font-bold mb-1">Fournisseur principal</div>
          <select value={primarySupplierId} onChange={(e) => setPrimarySupplierId(e.target.value)} className="rounded-lg px-3 py-3 w-full mb-4" style={inputStyle}>
            <option value="">— Aucun —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <div className="text-xs text-[#a88f78] uppercase font-bold mb-1">Seuil d'alerte (optionnel)</div>
          <input
            value={alertThreshold}
            onChange={(e) => setAlertThreshold(e.target.value)}
            inputMode="decimal"
            placeholder="Ex. 5"
            className="rounded-lg px-3 py-3 w-full mb-6"
            style={inputStyle}
          />

          <div className="flex flex-col gap-3">
            <button onClick={save} disabled={saving} className="tap-scale rounded-full py-4 text-lg font-bold" style={{ background: "#C0392B", color: "#fff5ea" }}>
              Enregistrer
            </button>
            <button onClick={onClose} className="tap-scale rounded-full py-4 text-lg font-bold border-2 border-[#3a2b1f] text-[#c9b8a4]">
              Annuler
            </button>
            {product && (
              <button
                onClick={() => {
                  updateApproProduct(product.id, { isActive: !product.isActive }).catch((err) => console.error(err));
                  onClose();
                }}
                className="tap-scale rounded-full py-3 text-sm font-bold border-2 border-[#3a2b1f] text-[#a88f78]"
              >
                {product.isActive ? "🗄️ Archiver ce produit" : "♻️ Réactiver ce produit"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SupplierModal({ supplier, onClose }) {
  const [name, setName] = useState(supplier?.name || "");
  const [contactName, setContactName] = useState(supplier?.contactName || "");
  const [phone, setPhone] = useState(supplier?.phone || "");
  const [email, setEmail] = useState(supplier?.email || "");
  const [deliveryDay, setDeliveryDay] = useState(supplier?.deliveryDay || "");
  const [notes, setNotes] = useState(supplier?.notes || "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const payload = { name: name.trim(), contactName, phone, email, deliveryDay, notes };
      if (supplier) await updateApproSupplier(supplier.id, payload);
      else await insertApproSupplier(payload);
      onClose();
    } catch (err) {
      console.error(err);
      alert("Échec de l'enregistrement du fournisseur.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
      <div className="w-full md:max-w-md rounded-3xl overflow-hidden overflow-y-auto max-h-[90vh]" style={{ background: "#1a120b", color: "#f5ebdd" }}>
        <div className="px-6 py-6">
          <div className="font-bold text-lg mb-5">{supplier ? "Modifier le fournisseur" : "Nouveau fournisseur"}</div>

          <div className="text-xs text-[#a88f78] uppercase font-bold mb-1">Nom</div>
          <input value={name} onChange={(e) => setName(e.target.value)} className="rounded-lg px-3 py-3 w-full mb-4" style={inputStyle} autoFocus />

          <div className="text-xs text-[#a88f78] uppercase font-bold mb-1">Contact (optionnel)</div>
          <input value={contactName} onChange={(e) => setContactName(e.target.value)} className="rounded-lg px-3 py-3 w-full mb-4" style={inputStyle} />

          <div className="text-xs text-[#a88f78] uppercase font-bold mb-1">Téléphone (optionnel)</div>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="rounded-lg px-3 py-3 w-full mb-4" style={inputStyle} />

          <div className="text-xs text-[#a88f78] uppercase font-bold mb-1">Email (optionnel)</div>
          <input value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-lg px-3 py-3 w-full mb-4" style={inputStyle} />

          <div className="text-xs text-[#a88f78] uppercase font-bold mb-1">Jour de livraison (optionnel)</div>
          <input value={deliveryDay} onChange={(e) => setDeliveryDay(e.target.value)} placeholder="Ex. mardi, jeudi" className="rounded-lg px-3 py-3 w-full mb-4" style={inputStyle} />

          <div className="text-xs text-[#a88f78] uppercase font-bold mb-1">Notes (optionnel)</div>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="rounded-lg px-3 py-3 w-full mb-6" style={inputStyle} />

          <div className="flex flex-col gap-3">
            <button onClick={save} disabled={saving} className="tap-scale rounded-full py-4 text-lg font-bold" style={{ background: "#C0392B", color: "#fff5ea" }}>
              Enregistrer
            </button>
            <button onClick={onClose} className="tap-scale rounded-full py-4 text-lg font-bold border-2 border-[#3a2b1f] text-[#c9b8a4]">
              Annuler
            </button>
            {supplier && (
              <button
                onClick={() => {
                  updateApproSupplier(supplier.id, { isActive: !supplier.isActive }).catch((err) => console.error(err));
                  onClose();
                }}
                className="tap-scale rounded-full py-3 text-sm font-bold border-2 border-[#3a2b1f] text-[#a88f78]"
              >
                {supplier.isActive ? "🗄️ Archiver ce fournisseur" : "♻️ Réactiver ce fournisseur"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ApprovisionnementAdmin() {
  const { approSuppliers } = useApproSuppliers();
  const { approProducts } = useApproProducts();
  const [view, setView] = useState("products"); // "products" | "suppliers"
  const [supplierFilter, setSupplierFilter] = useState("");
  const [movementFor, setMovementFor] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [creatingSupplier, setCreatingSupplier] = useState(false);

  const activeSuppliers = approSuppliers.filter((s) => s.isActive);
  const activeProducts = approProducts
    .filter((p) => p.isActive)
    .filter((p) => !supplierFilter || p.primarySupplierId === supplierFilter)
    .sort((a, b) => a.name.localeCompare(b.name));
  const supplierName = (id) => approSuppliers.find((s) => s.id === id)?.name || "—";

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <div className="flex gap-3 mb-6">
        <button onClick={() => setView("products")} className={`tap-scale rounded-full px-5 py-3 font-bold border-2 ${view === "products" ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>
          📦 Produits
        </button>
        <button onClick={() => setView("suppliers")} className={`tap-scale rounded-full px-5 py-3 font-bold border-2 ${view === "suppliers" ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>
          🚚 Fournisseurs
        </button>
      </div>

      {view === "products" && (
        <>
          <div className="flex flex-wrap items-center gap-3 mb-5">
            <select value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)} className="rounded-lg px-3 py-2 text-sm" style={inputStyle}>
              <option value="">Tous les fournisseurs</option>
              {activeSuppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <button onClick={() => setCreatingProduct(true)} className="tap-scale rounded-full px-5 py-2 text-sm font-bold border-2 border-[#3a2b1f]">
              + Nouveau produit
            </button>
          </div>

          {activeProducts.length === 0 && <p className="text-[#8a7561]">Aucun produit pour l'instant.</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeProducts.map((p) => {
              const low = p.alertThreshold != null && p.currentStock <= p.alertThreshold;
              return (
                <div
                  key={p.id}
                  className="rounded-xl p-4 flex items-center justify-between gap-3"
                  style={low ? { background: "#2c1c14", border: "1px solid #C0392B" } : { background: "#211712", border: "1px solid #3a2b1f" }}
                >
                  <div className="min-w-0 cursor-pointer" onClick={() => setEditingProduct(p)}>
                    <div className="font-bold truncate">
                      {low && "⚠️ "}
                      {p.name}
                    </div>
                    <div className="text-sm text-[#a88f78]">
                      {p.currentStock} {p.unit} · {supplierName(p.primarySupplierId)}
                    </div>
                  </div>
                  <button onClick={() => setMovementFor(p)} className="tap-scale shrink-0 rounded-full w-10 h-10 text-lg font-bold border-2 border-[#3a2b1f]">
                    +
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {view === "suppliers" && (
        <>
          <button onClick={() => setCreatingSupplier(true)} className="tap-scale rounded-full px-5 py-2 text-sm font-bold border-2 border-[#3a2b1f] mb-5">
            + Nouveau fournisseur
          </button>
          {activeSuppliers.length === 0 && <p className="text-[#8a7561]">Aucun fournisseur pour l'instant.</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeSuppliers.map((s) => (
              <div key={s.id} onClick={() => setEditingSupplier(s)} className="tap-scale cursor-pointer rounded-xl p-4" style={{ background: "#211712", border: "1px solid #3a2b1f" }}>
                <div className="font-bold mb-1">🚚 {s.name}</div>
                <div className="text-sm text-[#a88f78]">
                  {[s.contactName, s.phone, s.deliveryDay && `livraison ${s.deliveryDay}`].filter(Boolean).join(" · ") || "Aucun détail renseigné"}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {movementFor && <MovementModal product={movementFor} suppliers={activeSuppliers} onClose={() => setMovementFor(null)} />}
      {(editingProduct || creatingProduct) && (
        <ProductModal
          product={editingProduct}
          suppliers={activeSuppliers}
          onClose={() => {
            setEditingProduct(null);
            setCreatingProduct(false);
          }}
        />
      )}
      {(editingSupplier || creatingSupplier) && (
        <SupplierModal
          supplier={editingSupplier}
          onClose={() => {
            setEditingSupplier(null);
            setCreatingSupplier(false);
          }}
        />
      )}
    </div>
  );
}
