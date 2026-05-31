// ==UserScript==
// @name         LSS Karte
// @namespace    http://tampermonkey.net/
// @version      4.0.0
// @description  Karte mit Bundesländer, Regierungsbezirke und Gemeinden für DE und AT.
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
    const BASE_URL = "https://raw.githubusercontent.com/Medicopter117/DispoPlus/refs/heads/master/";

    const SOURCES = {
        1: { de: "deutschland/bundeslander.json", at: "osterreich/bundeslander.json" },
        2: { de: "deutschland/regierungbezirke.json", at: "osterreich/regierungbezirke.json" },
        3: { de: "deutschland/stadte.json", at: "osterreich/stadte.json" }
    };

    $('head').append($('<link rel="stylesheet" type="text/css" />').attr('href', 'https://cdn.rawgit.com/patosai/tree-multiselect/v2.4.1/dist/jquery.tree-multiselect.min.css'));

    $('head').append(`
        <style>
            .lss-tab-nav { margin-bottom: 15px; border-bottom: 1px solid #ccc; padding-left: 0; list-style: none; display: flex; background: #333; }
            .lss-tab-nav li { margin-bottom: -1px; }
            .lss-tab-nav a { display: block; padding: 10px 15px; color: #fff; font-weight: bold; text-decoration: none; border-right: 1px solid #555; }
            .lss-tab-nav li.active a { background: #555; color: #fff; border-bottom: 2px solid #f0ad4e; }
            .tab-content-panel { display: none; }
            .tab-content-panel.active { display: block; }
            /* Fix für Anzeigefehler in image_a45300.png */
            #kreise-modal { width: 70% !important; height: 80vh !important; display: flex; flex-direction: column; top: 10% !important; left: 15% !important; }
            .modal-body { flex: 1; overflow-y: auto; }
            .tree-multiselect { color: #333 !important; }
            .tree-multiselect .item { color: #333 !important; white-space: normal; }
            .tree-multiselect .section-name { color: #000 !important; font-weight: bold; }
        </style>
    `);

    let openBtn = '<a id="kreise-openBtn" class="leaflet-control-custom" href="#" style="display:block; width: 26px; height: 26px; background-color: white; background-image: url(https://cdn-icons-png.flaticon.com/512/2838/2838912.png); background-size: 20px 20px; background-repeat: no-repeat; background-position: center; border-bottom: 1px solid #ccc; cursor:pointer;"></a>';

    let checkInterval = setInterval(function() {
        if ($('.leaflet-control-zoom').length) {
            $('.leaflet-control-zoom').append(openBtn);
            clearInterval(checkInterval);
        }
    }, 500);

    $('body').append(`
        <div id="kreise-modal" style="display: none; z-index: 99999; background: #fff; position: absolute; border: 1px solid #222; box-shadow: 0 5px 15px rgba(0,0,0,.5);">
            <div class="modal-header" style="background:#222; color:#fff; padding: 10px 15px;">
                <button type="button" class="close kreise-close" style="color:#fff;">×</button>
                <h3 style="margin:0; font-size:18px;">Angezeigte Grenzen & Ebenen</h3>
            </div>
            <ul class="lss-tab-nav">
                <li class="active" data-tab="1"><a href="#">Bundesländer</a></li>
                <li data-tab="2"><a href="#">Regierungsbezirke</a></li>
                <li data-tab="3"><a href="#">Städte/Gemeinden</a></li>
            </ul>
            <div class="modal-body">
                <div id="panel-lvl-1" class="tab-content-panel active"><p>Lade Daten...</p></div>
                <div id="panel-lvl-2" class="tab-content-panel"><p>Klicke zum Laden...</p></div>
                <div id="panel-lvl-3" class="tab-content-panel"><p>Klicke zum Laden...</p></div>
            </div>
            <div class="modal-footer" style="padding: 10px; text-align: right; border-top: 1px solid #ddd;">
                <button class="btn kreise-close">Schließen</button>
                <button id="kreise-btn-save" class="btn btn-primary">Speichern & Neuladen</button>
            </div>
        </div>
    `);

    let loadedLevels = {};

    function loadTabLevel(level) {
        if (loadedLevels[level]) return;

        let panel = $(`#panel-lvl-${level}`);
        let saved = JSON.parse(localStorage.getItem(STORAGE_PREFIX + level)) || [];
        let selectMarkup = `<select id="kreise-selection-lvl-${level}" multiple="multiple">`;

        function fetchAndAppend(url, countryName) {
            return $.getJSON(BASE_URL + url).then(function(data) {
                data.features.forEach(feature => {
                    let p = feature.properties || {};
                    let name = p.NAME_4 || p.NAME_3 || p.NAME_2 || p.NAME_1 || p.name || p.label || "Ohne Name";
                    let sectionPath = countryName;
                    if (level === 1) sectionPath += "/Bundesländer";
                    else if (level === 2) sectionPath += `/Regierungsbezirke/${p.NAME_1 || "Sonstige"}`;
                    else if (level === 3) sectionPath += `/${p.NAME_1 || "Sonstige"}/${p.NAME_2 || "Ohne LK"}`;

                    let id = p.GID_4 || p.GID_3 || p.GID_2 || p.GID_1 || feature.id || Math.floor(Math.random() * 100000);
                    let isSelected = saved.includes(String(id)) ? 'selected' : '';
                    selectMarkup += `<option value="${id}" ${isSelected} data-section="${sectionPath}">${name}</option>`;
                });
            });
        }

        $.when(fetchAndAppend(SOURCES[level].de, "Deutschland"), fetchAndAppend(SOURCES[level].at, "Österreich")).done(function() {
            selectMarkup += `</select>`;
            panel.html(selectMarkup);
            $.getScript("https://cdn.rawgit.com/patosai/tree-multiselect/v2.4.1/dist/jquery.tree-multiselect.min.js", function () {
                $(`#kreise-selection-lvl-${level}`).treeMultiselect({ searchable: true, startCollapsed: true });
            });
            loadedLevels[level] = true;
        });
    }

    $(document).on('click', '#kreise-openBtn', function(e) { e.preventDefault(); $('#kreise-modal').show(); loadTabLevel(1); });
    $('.kreise-close').click(function() { $('#kreise-modal').hide(); });
    $('.lss-tab-nav li').click(function(e) {
        let tab = $(this).data('tab');
        $('.lss-tab-nav li').removeClass('active');
        $(this).addClass('active');
        $('.tab-content-panel').removeClass('active');
        $(`#panel-lvl-${tab}`).addClass('active');
        loadTabLevel(tab);
    });

    $('#kreise-btn-save').click(function() {
        for (let l = 1; l <= 3; l++) {
            let val = $(`#kreise-selection-lvl-${l}`).val() || [];
            localStorage.setItem(STORAGE_PREFIX + l, JSON.stringify(val));
        }
        location.reload();
    });
})();
