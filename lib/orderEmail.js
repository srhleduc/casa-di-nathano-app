// Email de confirmation de commande (Resend). Jamais bloquant : sans clé
// (RESEND_API_KEY) ou sans expéditeur (RESEND_FROM), on ne fait rien.

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export async function sendOrderConfirmationEmail({ to, restaurantName, number, isDelivery, items, total, trackingUrl }) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!key || !from) return { skipped: true };

  const lines = (items || [])
    .map((it) => `<li>${esc(it.qty ?? 1)} × ${esc(it.name || it.label || "Article")}</li>`)
    .join("");
  const eur = total != null ? `${Number(total).toFixed(2).replace(".", ",")} €` : "";
  const html = `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#2b1d14">
<h2 style="margin:0 0 8px">${esc(restaurantName)}</h2>
<p>Merci ! Votre commande <strong>N°${esc(number)}</strong> est bien enregistrée${isDelivery ? " (livraison)" : " (à emporter)"}.</p>
${lines ? `<ul style="padding-left:18px">${lines}</ul>` : ""}
${eur ? `<p><strong>Total : ${eur}</strong> — à régler ${isDelivery ? "au livreur" : "sur place"}.</p>` : ""}
<p><a href="${esc(trackingUrl)}" style="display:inline-block;background:#C0392B;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:bold">Suivre ma commande</a></p>
<p style="font-size:12px;color:#8a7561">Cette page se met à jour toute seule. Lien personnel : ne le partagez pas.</p>
</div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject: `${restaurantName} — commande N°${number} bien reçue`, html }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return { sent: true };
}
