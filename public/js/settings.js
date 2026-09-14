(function () {
  "use strict";

  const KEY = "deadSector.settings.v1";
  const DEFAULTS = Object.freeze({ ...window.HordeConfig.defaults, fpsManual: false });

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function sanitize(value) {
    const allowedFps = window.HordeConfig.fpsOptions;
    const fps = allowedFps.includes(Number(value?.fps)) ? Number(value.fps) : DEFAULTS.fps;
    const sensitivity = clamp(Number(value?.sensitivity) || DEFAULTS.sensitivity, 0.0015, 0.006);
    const volume = clamp(Number.isFinite(Number(value?.volume)) ? Number(value.volume) : DEFAULTS.volume, 0, 1);
    const fov = clamp(Number(value?.fov) || DEFAULTS.fov, 70, 110);
    return { fps, sensitivity, volume, fov, adsMode: value?.adsMode === 'hold' ? 'hold' : 'toggle', haptics: value?.haptics !== false, fpsManual: value?.fpsManual === true };
  }

  function load() {
    try {
      return sanitize(JSON.parse(localStorage.getItem(KEY) || "{}"));
    } catch (_) {
      return { ...DEFAULTS };
    }
  }

  function save(next) {
    const settings = sanitize(next);
    try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch {}
    window.dispatchEvent(new CustomEvent("deadsector:settings", { detail: settings }));
    return settings;
  }

  function reset() {
    try { localStorage.removeItem(KEY); } catch {}
    return save(DEFAULTS);
  }

  function bindDialog() {
    const dialog = document.getElementById("settings-dialog");
    const form = document.getElementById("settings-form");
    const fps = document.getElementById("fps-setting");
    const sensitivity = document.getElementById("sensitivity-setting");
    const sensitivityValue = document.getElementById("sensitivity-value");
    const volume = document.getElementById("volume-setting");
    const volumeValue = document.getElementById("volume-value");
    const resetButton = document.getElementById("reset-settings");
    const fov = document.getElementById('fov-setting');
    const adsMode = document.getElementById('ads-setting');
    const haptics = document.getElementById('haptics-setting');
    const language = document.getElementById('language-setting');

    if (!dialog || !form || !fps || !sensitivity || !volume) return;

    function fill(settings = load()) {
      fps.value = String(settings.fps);
      sensitivity.value = String(settings.sensitivity);
      volume.value = String(settings.volume);
      sensitivityValue.textContent = Number(settings.sensitivity).toFixed(4);
      volumeValue.textContent = `${Math.round(settings.volume * 100)}%`;
      fov.value = settings.fov;
      document.getElementById('fov-value').textContent = `${settings.fov}°`;
      adsMode.value = settings.adsMode; haptics.checked = settings.haptics;
      language.value = window.HordeUI.language;
    }

    document.querySelectorAll("[data-open-settings]").forEach((button) => {
      button.addEventListener("click", () => {
        fill();
        if (typeof dialog.showModal === "function") dialog.showModal();
        else dialog.setAttribute("open", "");
      });
    });

    sensitivity.addEventListener("input", () => {
      sensitivityValue.textContent = Number(sensitivity.value).toFixed(4);
    });

    volume.addEventListener("input", () => {
      volumeValue.textContent = `${Math.round(Number(volume.value) * 100)}%`;
    });

    resetButton?.addEventListener("click", () => fill(reset()));
    fov.addEventListener('input', () => {
      document.getElementById('fov-value').textContent = `${fov.value}°`;
      window.dispatchEvent(new CustomEvent('horde:fov-preview', { detail: Number(fov.value) }));
    });
    dialog.addEventListener('close', () => window.dispatchEvent(new CustomEvent('horde:fov-preview', { detail: load().fov })));
    language.addEventListener('change', () => window.HordeUI.setLanguage(language.value));

    form.addEventListener("submit", (event) => {
      if (event.submitter?.value !== "cancel") {
        save({
          fps: Number(fps.value),
          sensitivity: Number(sensitivity.value),
          volume: Number(volume.value),
          fov: Number(fov.value), adsMode: adsMode.value, haptics: haptics.checked, fpsManual: true,
        });
      }
    });
  }

  window.DeadSectorSettings = { DEFAULTS, load, save, reset, bindDialog };
  document.addEventListener("DOMContentLoaded", bindDialog);
  async function detectPerformance() {
    if (load().fpsManual || document.hidden) return;
    const deltas = []; let previous = 0;
    await new Promise(resolve => {
      const sample = now => {
        if (document.hidden) { resolve(); return; }
        if (previous) deltas.push(now - previous);
        previous = now;
        if (deltas.length < 75) requestAnimationFrame(sample); else resolve();
      }; requestAnimationFrame(sample);
    });
    if (deltas.length < 60 || load().fpsManual) return;
    deltas.sort((a,b) => a-b);
    const rate = 1000 / deltas[Math.floor(deltas.length * 0.8)];
    const fps = window.HordeConfig.fpsOptions.filter(value => value <= rate * 1.06).pop() || 30;
    save({ ...load(), fps, fpsManual: false });
  }
  document.addEventListener('DOMContentLoaded', () => { void detectPerformance(); });
})();
