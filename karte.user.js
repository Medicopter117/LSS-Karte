// ==UserScript==
// @name         LSS Karte
// @namespace    http://tampermonkey.net/
// @version      4.1.0
// @description  Karte mit Bundesländer, Regierungsbezirke und Gemeinden für DE und AT -- Mit Einstellung.
// @author       Jalibu, LennyPegauOfficial & AI
// @match        https://www.leitstellenspiel.de/
// @match        https://www.leitstellenspiel.de/profile/*
// @match        https://polizei.leitstellenspiel.de/
// @match        https://polizei.leitstellenspiel.de/profile/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';
    const STORAGE_PREFIX = 'LSS_KREIS_LVL_';
    const COLOR_KEYS = { 1: 'LSS_COLOR_1', 2: 'LSS_COLOR_2', 3: 'LSS_COLOR_3' };
    const BASE_URL = "https://raw.githubusercontent.com/Medicopter117/LSS-Karte/refs/heads/master/";
    const SOURCES = {
        1: { de: "deutschland/bundeslander.json", at: "osterreich/bundeslander.json" },
        2: { de: "deutschland/regierungbezirke.json", at: "osterreich/regierungbezirke.json" },
        3: { de: "deutschland/stadte.json", at: "osterreich/stadte.json" }
    };

    $('head').append($('<link rel="stylesheet" type="text/css" />').attr('href', 'https://cdn.rawgit.com/patosai/tree-multiselect/v2.4.1/dist/jquery.tree-multiselect.min.css'));
    $('head').append(`
        <style>
            .lss-tab-nav { display: flex; background: #eee; list-style: none; padding: 0; margin: 0; border-bottom: 2px solid #ccc; }
            .lss-tab-nav li { padding: 12px 20px; color: #333; cursor: pointer; font-weight: bold; }
            .lss-tab-nav li.active { background: #fff; border-top: 3px solid #f0ad4e; }
            .tab-content-panel { display: none; padding: 20px; color: #333; }
            .tab-content-panel.active { display: block; }
            #kreise-modal { width: 70%; height: 80vh; position: absolute; top: 10%; left: 15%; background: #fff; z-index: 99999; border: 1px solid #777; display: flex; flex-direction: column; box-shadow: 0 10px 25px rgba(0,0,0,0.3); }
            .color-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px; padding: 10px; background: #f9f9f9; border-radius: 5px; }
        </style>
    `);

    $('body').append(`
        <div id="kreise-modal" style="display: none;">
            <div style="background:#f4f4f4; color:#333; padding: 15px; border-bottom:1px solid #ccc; font-weight:bold;">Konfiguration <button class="kreise-close" style="float:right; cursor:pointer;">×</button></div>
            <ul class="lss-tab-nav">
                <li class="active" data-tab="1">Länder</li>
                <li data-tab="2">Bezirke</li>
                <li data-tab="3">Städte</li>
                <li data-tab="4">Farben</li>
            </ul>
            <div id="modal-body" style="flex:1; overflow-y:auto;">
                <div id="panel-lvl-1" class="tab-content-panel active"></div>
                <div id="panel-lvl-2" class="tab-content-panel"></div>
                <div id="panel-lvl-3" class="tab-content-panel"></div>
                <div id="panel-lvl-4" class="tab-content-panel">
                    <div class="color-row"><label>Bundesländer Farbe:</label> <input type="color" id="color-1" value="${localStorage.getItem(COLOR_KEYS[1]) || '#0000FF'}"></div>
                    <div class="color-row"><label>Bezirke Farbe:</label> <input type="color" id="color-2" value="${localStorage.getItem(COLOR_KEYS[2]) || '#FF0000'}"></div>
                    <div class="color-row"><label>Städte Farbe:</label> <input type="color" id="color-3" value="${localStorage.getItem(COLOR_KEYS[3]) || '#FFFF00'}"></div>
                </div>
            </div>
            <div style="padding:15px; border-top:1px solid #ccc; text-align:right; background:#f9f9f9;">
                <button id="kreise-btn-save" class="btn btn-primary" style="padding:10px 20px;">Speichern & Neuladen</button>
            </div>
        </div>
    `);

    function loadTabLevel(level) {
        if (level == 4) return;
        let panel = $(`#panel-lvl-${level}`);
        panel.html('<p style="padding:20px; font-weight:bold; color:#333;">Bitte warten. lädt...</p>');
        let saved = JSON.parse(localStorage.getItem(STORAGE_PREFIX + level)) || [];
        let selectMarkup = `<select id="kreise-selection-lvl-${level}" multiple="multiple">`;

        function fetchAndAppend(url, countryName) {
            return $.getJSON(BASE_URL + url).then(function(data) {
                data.features.forEach(f => {
                    let p = f.properties || {};
                    let name = p.NAME_4 || p.NAME_3 || p.NAME_2 || p.NAME_1 || p.name || "Ohne Name";
                    let path = countryName + (level === 1 ? "/Bundesländer" : (level === 2 ? `/Regierungsbezirke/${p.NAME_1 || "Sonstige"}` : `/${p.NAME_1 || "Sonstige"}/${p.NAME_2 || "Ohne LK"}`));
                    let id = p.GID_4 || p.GID_3 || p.GID_2 || p.GID_1 || f.id || Math.random();
                    selectMarkup += `<option value="${id}" ${saved.includes(String(id)) ? 'selected' : ''} data-section="${path}">${name}</option>`;
                });
            });
        }
        $.when(fetchAndAppend(SOURCES[level].de, "Deutschland"), fetchAndAppend(SOURCES[level].at, "Österreich")).done(function() {
            selectMarkup += `</select>`;
            panel.html(selectMarkup);
            $.getScript("https://cdn.rawgit.com/patosai/tree-multiselect/v2.4.1/dist/jquery.tree-multiselect.min.js", function () {
                $(`#kreise-selection-lvl-${level}`).treeMultiselect({ searchable: true, startCollapsed: true });
            });
        });
    }

    function draw() {
        if (typeof map === 'undefined') return;
        for (let l = 1; l <= 3; l++) {
            let savedIds = JSON.parse(localStorage.getItem(STORAGE_PREFIX + l)) || [];
            let color = localStorage.getItem(COLOR_KEYS[l]) || '#ff7800';
            if (savedIds.length === 0) continue;
            [SOURCES[l].de, SOURCES[l].at].forEach(url => {
                $.getJSON(BASE_URL + url, (data) => {
                    L.geoJSON(data, {
                        filter: f => savedIds.includes(String(f.properties.GID_4 || f.properties.GID_3 || f.properties.GID_2 || f.properties.GID_1 || f.id)),
                        style: { color: color, weight: 3, opacity: 0.6, fillOpacity: 0.1 }
                    }).addTo(map);
                });
            });
        }
    }

    $(document).on('click', '#kreise-openBtn', (e) => { e.preventDefault(); $('#kreise-modal').show(); loadTabLevel(1); });
    $('.kreise-close').click(() => $('#kreise-modal').hide());
    $('.lss-tab-nav li').click(function() {
        $('.lss-tab-nav li').removeClass('active'); $(this).addClass('active');
        $('.tab-content-panel').removeClass('active');
        let tab = $(this).data('tab');
        $(`#panel-lvl-${tab}`).addClass('active');
        loadTabLevel(tab);
    });

    $('#kreise-btn-save').click(function() {
        $(this).text('Bitte warten. lädt...');
        for (let l = 1; l <= 3; l++) {
            localStorage.setItem(COLOR_KEYS[l], $('#color-' + l).val());
            localStorage.setItem(STORAGE_PREFIX + l, JSON.stringify($(`#kreise-selection-lvl-${l}`).val() || []));
        }
        location.reload();
    });

    let checkInterval = setInterval(() => {
        if ($('.leaflet-control-zoom').length) {
            $('.leaflet-control-zoom').append('<a id="kreise-openBtn" href="#" style="display:block; width: 26px; height: 26px; background: white url(https://cdn-icons-png.flaticon.com/512/2838/2838912.png) center/20px no-repeat; border-bottom:1px solid #ccc; cursor:pointer;"></a>');
            draw();
            clearInterval(checkInterval);
        }
    }, 500);
})();
