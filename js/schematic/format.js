/* Форматирование физических величин для отображения.
   Чистые функции, без состояния.

   Регистрируется в window.SchematicApp.format.
*/
(function () {
  'use strict';

  window.SchematicApp = window.SchematicApp || {};

  function voltage(v) {
    const a = Math.abs(v);
    if (a < 1e-6) return '0.00 В';
    if (a >= 1000) return (v / 1000).toFixed(2) + ' кВ';
    if (a >= 1)    return v.toFixed(2) + ' В';
    if (a >= 1e-3) return (v * 1e3).toFixed(1) + ' мВ';
    return (v * 1e6).toFixed(1) + ' мкВ';
  }

  function current(i) {
    const a = Math.abs(i);
    if (a < 1e-9) return '0.00 А';
    if (a >= 1)    return i.toFixed(3) + ' А';
    if (a >= 1e-3) return (i * 1e3).toFixed(1) + ' мА';
    if (a >= 1e-6) return (i * 1e6).toFixed(1) + ' мкА';
    return (i * 1e9).toFixed(1) + ' нА';
  }

  function resistance(r) {
    if (!isFinite(r) || isNaN(r) || r >= 1e10) return '∞';
    if (r < 0.5)  return '0.00 Ом';
    if (r < 1)    return r.toFixed(2) + ' Ом';
    if (r < 1000) return r.toFixed(0) + ' Ом';
    if (r < 1e6)  return (r / 1e3).toFixed(2) + ' кОм';
    return (r / 1e6).toFixed(2) + ' МОм';
  }

  function power(p) {
    const a = Math.abs(p);
    if (a < 1e-9) return '0.00 Вт';
    if (a >= 1)    return p.toFixed(2) + ' Вт';
    if (a >= 1e-3) return (p * 1e3).toFixed(1) + ' мВт';
    if (a >= 1e-6) return (p * 1e6).toFixed(1) + ' мкВт';
    return (p * 1e9).toFixed(1) + ' нВт';
  }

  window.SchematicApp.format = {
    voltage,
    current,
    resistance,
    power,

    // Алиасы под старые имена (на время миграции)
    formatVoltage: voltage,
    formatCurrent: current,
    formatResistance: resistance,
    formatPower: power
  };
})();