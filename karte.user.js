// ==UserScript==
// @name         LSS Karte
// @namespace    http://tampermonkey.net/
// @version      3.0.2
// @description  Karte mit Bundesländer, Landkreise und Städte.
// @author       Jalibu, LennyPegauOfficial & AI
// @match        https://www.leitstellenspiel.de/
// @match        https://www.leitstellenspiel.de/profile/*
// @match        https://polizei.leitstellenspiel.de/
// @match        https://polizei.leitstellenspiel.de/profile/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    const STORAGE_PREFIX = 'LSS_KREIS_LVL_';
    const BASE_URL = "https://raw.githubusercontent.com/Medicopter117/DispoPlus/refs/heads/master/deutschland/";

    const FILE_MAP = {
        1: "bundeslander.json",
        2: "regierungbezirke.json",
        3: "stadte.json",
    };

    $('head').append(`<style>
        .lss-tab-nav { margin-bottom: 15px; border-bottom: 1px solid #ccc; padding-left: 0; list-style: none; display: flex; background: #333; }
        .lss-tab-nav li { margin-bottom: -1px; }
        .lss-tab-nav a { display: block; padding: 10px 15px; color: #fff; font-weight: bold; text-decoration: none; border-right: 1px solid #555; }
        .lss-tab-nav li.active a { background: #555; color: #fff; border-bottom: 2px solid #f0ad4e; }
        .tab-content-panel { display: none; }
        .tab-content-panel.active { display: block; }
        #kreise-openBtn { border-top: 1px solid #ccc; }
    </style>`);

    // Initialisierung des Buttons ohne Lag
    let initInterval = setInterval(() => {
        if ($('.leaflet-control-zoom').length > 0 && !$('#kreise-openBtn').length) {
            $('.leaflet-control-zoom').append(`
                <a id="kreise-openBtn" href="#" style="display: block; width: 26px; height: 26px; background-color: white; 
                background-image: url('https://raw.githubusercontent.com/jalibu/LSHeat/master/icons8-germany-map-50.png'); 
                background-size: 20px 20px; background-repeat: no-repeat; background-position: center; cursor: pointer;">
                </a>
            `);
            clearInterval(initInterval);
        }
    }, 1000);

    $(document).on('click', '#kreise-openBtn', function(e) {
        e.preventDefault();
        $('#kreise-modal').show();
        loadTabLevel(1);
    });

    let markup = `
        <div id="kreise-modal" style="display: none; z-index: 99999; background: #fff; top: 20px; position: absolute; width: 60%; left: 20%; border: 1px solid #222; box-shadow: 0 5px 15px rgba(0,0,0,.5);">
            <div class="modal-header" style="background:#222; color:#fff; padding: 10px 15px;">
                <button type="button" class="close kreise-close" style="color:#fff; opacity:0.8;">×</button>
                <h3 style="margin:0; font-size:18px;">Angezeigte Grenzen & Ebenen</h3>
            </div>
            <ul class="lss-tab-nav">
                <li class="active" data-tab="1"><a href="#">Bundesländer</a></li>
                <li data-tab="2"><a href="#">Regierungsbezirke</a></li>
                <li data-tab="3"><a href="#">VG, Gemeinde & Städte</a></li>
            </ul>
            <div class="modal-body" style="overflow-y: auto; max-height: 400px; padding: 15px;">
                <div id="panel-lvl-1" class="tab-content-panel active"><p>Lade Bundesländer...</p></div>
                <div id="panel-lvl-2" class="tab-content-panel"><p>Klicke auf den Tab zum Laden...</p></div>
                <div id="panel-lvl-3" class="tab-content-panel"><p>Klicke auf den Tab zum Laden...</p></div>
            </div>
            <div class="modal-footer" style="padding: 10px 15px; text-align: right; border-top: 1px solid #ddd;">
                <button class="btn kreise-close" style="background:#555; color:#fff;">Schließen</button>
                <button id="kreise-btn-save" class="btn btn-primary" style="background:#f0ad4e; border-color:#eea236;">Speichern & Neuladen</button>
            </div>
        </div>
    `;
    $('body').append(markup);

    let loadedLevels = {};

    function loadTabLevel(level) {
        if (loadedLevels[level]) return;

        let panel = $(`#panel-lvl-${level}`);
        let fileName = FILE_MAP[level];

        $.getJSON(BASE_URL + fileName, function(data) {
            let selected = JSON.parse(localStorage.getItem(STORAGE_PREFIX + level)) || [];
            let selectMarkup = `<select id="kreise-selection-lvl-${level}" multiple="multiple">`;

            for (let feature of data.features) {
                if (!feature.properties) continue;

                let state = feature.properties.NAME_1 || "Deutschland";
                let bezirk = feature.properties.NAME_2 || "";
                let kreis = feature.properties.NAME_3 || "";
                let ort = feature.properties.NAME_4 || "";

                let displayName = ort || kreis || bezirk || state;
                let pathParts = [state];
                if (level === 3 && bezirk && bezirk !== state) pathParts.push(bezirk);
                if (level === 3 && kreis && kreis !== displayName) pathParts.push(kreis);

                let gidLevel = level === 2 ? 2 : (level === 3 ? 4 : level);
                let featureId = feature.properties[`GID_${gidLevel}`] || feature.id || Math.random();

                selectMarkup += `<option value="${featureId}" ${selected.indexOf('' + featureId) >= 0 ? 'selected' : ''} data-section="${pathParts.join('/')}">${displayName}</option>`;
            }

            selectMarkup += `</select>`;
            panel.html(selectMarkup);

            $.getScript("https://cdn.rawgit.com/patosai/tree-multiselect/v2.4.1/dist/jquery.tree-multiselect.min.js", function(){
                $(`#kreise-selection-lvl-${level}`).treeMultiselect({searchable: true, startCollapsed: true});
            });

            loadedLevels[level] = true;
        });
    }

    // Beim Laden Grenzen auf Karte anzeigen
    for (let l = 1; l <= 3; l++) {
        let savedIds = JSON.parse(localStorage.getItem(STORAGE_PREFIX + l)) || [];
        if (savedIds.length > 0) {
            $.getJSON(BASE_URL + FILE_MAP[l], function(data) {
                let gidLevel = l === 2 ? 2 : (l === 3 ? 4 : l);
                for (let feature of data.features) {
                    let featureId = feature.properties[`GID_${gidLevel}`] || feature.id;
                    if (savedIds.indexOf('' + featureId) >= 0) {
                        L.geoJSON(feature, {style: { "weight": 2, "fillOpacity": 0.05 }}).addTo(map);
                    }
                }
            });
        }
    }

    $('.lss-tab-nav li').click(function(e) {
        e.preventDefault();
        let lvl = $(this).data('tab');
        $('.lss-tab-nav li').removeClass('active');
        $(this).addClass('active');
        $('.tab-content-panel').removeClass('active');
        $(`#panel-lvl-${lvl}`).addClass('active');
        loadTabLevel(lvl);
    });

    $('.kreise-close').click(function(){ $('#kreise-modal').hide(); });

    $('#kreise-btn-save').click(function(){
        for (let l = 1; l <= 3; l++) {
            if (loadedLevels[l]) localStorage.setItem(STORAGE_PREFIX + l, JSON.stringify($(`#kreise-selection-lvl-${l}`).val() || []));
        }
        location.reload();
    });

})();
