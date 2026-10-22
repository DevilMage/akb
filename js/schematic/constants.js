/* Общие физические константы симулятора.
   Раньше жили в main.js в виде разрозненных const.

   Регистрируется в window.SchematicApp.constants.
*/
(function () {
  'use strict';

  window.SchematicApp = window.SchematicApp || {};

  window.SchematicApp.constants = {
    // Лампочка накаливания
    LAMP_R: 45,

    // Внутренние сопротивления
    BATT_RINT: 0.5,
    SWITCH_R_CLOSED: 0.5,
    SWITCH_R_OPEN: 1e9,
    PIN_RINT: 25,

    // Мультиметр
    MM_R_VOLTAGE: 1e9,
    MM_R_CURRENT: 0.1,
    MM_R_RESISTANCE: 1e9,

    // 7-сегментный дисплей
    SEG_RINT: 300,
    SEG_VTH: 1.5,
    SEG_VFULL: 4.0,

    // Порог перегорания лампы (V / ratedV)
    LAMP_BURN_RATIO: 2,

    // Кэш решателя
    CIRCUIT_MIN_INTERVAL: 30
  };
})();