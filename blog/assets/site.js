
/*
  Configuración sencilla:
  1) Cambia GA_MEASUREMENT_ID por tu ID real, por ejemplo G-ABC1234567.
  2) Cambia WHATSAPP_CHANNEL_URL por la URL pública del canal.
*/
const SITE_CONFIG = {
  GA_MEASUREMENT_ID: "G-7V5M9TTKGV",
  WHATSAPP_CHANNEL_URL: "https://whatsapp.com/channel/0029Vb9813y7tkj1bIgcId3n"
};

function hasRealGaId(){
  return /^G-[A-Z0-9]{6,}$/.test(SITE_CONFIG.GA_MEASUREMENT_ID) &&
    SITE_CONFIG.GA_MEASUREMENT_ID !== "G-XXXXXXXXXX";
}

function loadGoogleAnalytics(){
  if(!hasRealGaId()) return;
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${SITE_CONFIG.GA_MEASUREMENT_ID}`;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  window.gtag = gtag;
  gtag("js", new Date());
  gtag("config", SITE_CONFIG.GA_MEASUREMENT_ID, {anonymize_ip:true});
}

function setupConsent(){
  if(!hasRealGaId()) return;
  const state = localStorage.getItem("relatos_analytics_consent");
  if(state === "yes"){ loadGoogleAnalytics(); return; }
  if(state === "no") return;
  const box = document.querySelector(".consent");
  if(!box) return;
  box.classList.add("show");
  box.querySelector("[data-accept]").onclick = () => {
    localStorage.setItem("relatos_analytics_consent","yes");
    box.classList.remove("show");
    loadGoogleAnalytics();
  };
  box.querySelector("[data-decline]").onclick = () => {
    localStorage.setItem("relatos_analytics_consent","no");
    box.classList.remove("show");
  };
}

function setupWhatsappLinks(){
  document.querySelectorAll("[data-whatsapp-channel]").forEach(a => {
    a.href = SITE_CONFIG.WHATSAPP_CHANNEL_URL;
  });
}

document.addEventListener("DOMContentLoaded",()=>{
  setupConsent();
  setupWhatsappLinks();
});
