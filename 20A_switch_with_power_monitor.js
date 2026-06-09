/*
    SMATRUL 20A Tuya RF433 Smart Zigbee
    Link: https://shopee.com.my/smatrul.os/43955652107
*/
const tz = require('zigbee-herdsman-converters/converters/toZigbee');
const exposes = require('zigbee-herdsman-converters/lib/exposes');
const reporting = require('zigbee-herdsman-converters/lib/reporting');
const e = exposes.presets;

const fzLocal = {
    // Note: acPowerDivisor attribute is unsupported and not writable.
    // Based on device documentation, activePower is reported in watts directly.
    electrical_measurement: {
        cluster: 'haElectricalMeasurement',
        type: ['attributeReport', 'readResponse'],
        convert: (model, msg, publish, options, meta) => {
            const result = {};
            if (msg.data.activePower !== undefined) result.power = msg.data.activePower;
            if (msg.data.rmsCurrent !== undefined) result.current = msg.data.rmsCurrent / 1000;
            if (msg.data.rmsVoltage !== undefined) result.voltage = msg.data.rmsVoltage;
            return result;
        },
    },
    metering: {
        cluster: 'seMetering',
        type: ['attributeReport', 'readResponse'],
        convert: (model, msg, publish, options, meta) => {
            const result = {};
            if (msg.data.currentSummDelivered !== undefined) {
                result.energy = msg.data.currentSummDelivered / 100;
            }
            return result;
        },
    },
};

const fz = require('zigbee-herdsman-converters/converters/fromZigbee');


/* =========================
   ADDED: Moes startup state
   ========================= */
const fzLocalMoes = {
    moes_startup_onoff: {
        cluster: 'genOnOff',
        type: ['attributeReport', 'readResponse'],
        convert: (model, msg) => {
            if (msg.data.moesStartUpOnOff === undefined) return;

            const map = {
                0: 'off',
                1: 'on',
                2: 'previous',
            };

            return {
                power_on_behavior: map[msg.data.moesStartUpOnOff],
            };
        },
    },
};

/* =========================
   ADDED: Moes startup control
   ========================= */
const tzLocalMoes = {
    moes_startup_onoff: {
        key: ['power_on_behavior'],
        convertSet: async (entity, key, value) => {
            const map = {
                off: 0,
                on: 1,
                previous: 2,
            };

            await entity.write('genOnOff', {
                moesStartUpOnOff: map[value],
            });
        },

        convertGet: async (entity) => {
            await entity.read('genOnOff', ['moesStartUpOnOff']);
        },
    },
};

const definition = {
    fingerprint: [{modelID: 'TS0001', manufacturerName: '_TZ3000_anptztic'}],
    model: 'TZ3000_anptztic',
    vendor: 'SMATRUL',
    description: 'SMATRUL 20A Zigbee smart switch with power monitoring',

    fromZigbee: [
        fz.on_off,
        fzLocal.electrical_measurement,
        fzLocal.metering,
        fzLocalMoes.moes_startup_onoff,
    ],

    toZigbee: [
        tz.on_off,
        tzLocalMoes.moes_startup_onoff,
    ],

    exposes: [
        e.switch(),
        e.power(),
        e.current(),
        e.voltage(),
        e.energy(),
        e.enum('power_on_behavior', exposes.access.ALL, [
            'off',
            'on',
            'previous',
        ]),
    ],

    configure: async (device, coordinatorEndpoint) => {
        const endpoint = device.getEndpoint(1);

        await reporting.bind(endpoint, coordinatorEndpoint, ['haElectricalMeasurement']);
        await reporting.activePower(endpoint, {min: 5, max: 30, change: 1});
        await reporting.rmsCurrent(endpoint, {min: 5, max: 30, change: 0.01});
        await reporting.rmsVoltage(endpoint, {min: 5, max: 60, change: 1});
    },
};

module.exports = definition;