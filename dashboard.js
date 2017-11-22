// UI Controller


var controller = function () {

    // ToDo: clear stats if user/boat changes
    var currentUserId;
    var requests = new Map();

    // Polars and other game parameters, indexed by polar._id
    var polars =  [];

    var races = [];

    var sailNames = [0, "Jib", "Spi", "Staysail", "Light Jib", "Code0", "Heavy Gnk", "Light Gnk", 8, 9, "Auto", "Jib(Auto)", "Spi(Auto)", "Staysail(Auto)", "Light Jib(Auto)", "Code0(Auto)", "Heavy Gnk(Auto)", "Light Gnk(Auto)"];

    function addSelOption(race, beta, disabled) {
        var option = document.createElement("option");
        option.text =race.name + (beta?" beta":"");
        option.value = race.id;
        option.betaflag = beta;
        option.disabled = disabled;
        selRace.appendChild(option);
    }
    
    function initRaces() {
        var xhr = new XMLHttpRequest();
        xhr.onload = function() {
            var json = xhr.responseText;
            json = JSON.parse(json);
            for (var i = 0; i < json.races.length; i++) {
                var race = json.races[i];
                races[race.id] = race;
                races[race.id].tableLines=[];
                addSelOption(race, false, true);
                if (race.has_beta) {
                    addSelOption(race, true, true);
                }
            }
            divRaceStatus = document.getElementById("raceStatus");
            divRaceStatus.innerHTML = makeRaceStatusHTML();
        }
        xhr.open('GET', 'http://zezo.org/races.json');
        xhr.send();
    }

    // Earth radius in nm, 360*60/(2*Pi);
    var radius =  3437.74683

    var selRace, cbRouter, cbReuseTab;
    var lbBoatname;
    var divPositionInfo, divRecordLog, divRawLog;
    var callUrlFunction;
    var initialized = false;

    var tableHeader =  "<tr>"
        + "<th>" + "Time" + "</th>"
        + "<th>" + "Position" + "</th>"
        + "<th>" + "Heading" + "</th>"
        + "<th>" + "TWS" + "</th>"
        + "<th>" + "TWD" + "</th>"
        + "<th>" + "TWA" + "</th>"
        + "<th>" + "vR (kn)" + "</th>"
        + "<th>" + "vC (kn)" + "</th>"
        + "<th>" + "vT (kn)" + "</th>"
        + "<th>" + "Δd (nm)" + "</th>"
        + "<th>" + "Δt (sec)" + "</th>"
        + "<th>" + "AutoSail" + "</th>"
        + "<th>" + "AutoTWA" + "</th>"
        + "<th>" + "Sail chng" + "</th>"
        + "<th>" + "Gybing" + "</th>"
        + "<th>" + "Tacking" + "</th>"
        +  "</tr>";

    var raceStatusHeader =  "<tr>"
        + "<th>" + "Race" + "</th>"
        + "<th>" + "Rank" + "</th>"
        + "<th>" + "Position" + "</th>"
        + "<th>" + "Heading" + "</th>"
        + "<th>" + "TWS" + "</th>"
        + "<th>" + "TWD" + "</th>"
        + "<th>" + "TWA" + "</th>"
        + "<th>" + "Boat speed" + "</th>"
        + "<th>" + "AutoTWA" + "</th>"
        + "<th>" + "DTF" + "</th>"
        + "<th>" + "Options" + "</th>"
        + "<th>" + "Cards" + "</th>"
        + "<th>" + "Sail" + "</th>" // red if badsail
        + "<th>" + "gnd" + "</th>"
        + "<th>" + "stlt" + "</th>"
        + "<th>" + "slow" + "</th>"
        + "<th>" + "Last Command" + "</th>"
        +  "</tr>";
   
	function printLastCommand(lcActions) {
		var lastCommand = "";
			
		lcActions.map( function (action) {
			if ( action.type == "heading" ) {
				lastCommand +=  (action.autoTwa?"TWA":"Heading") + '=' + roundTo(action.value, 1);
			} else if ( action.type == "sail" ) {
				lastCommand += 'Sail=' + sailNames[action.value];
			} else if ( action.type == "prog" ) {
				action.values.map(function ( progCmd ) {
					var progTime = new Date(progCmd.ts).toJSON().substring(0,19);
					lastCommand += (progCmd.autoTwa?"TWA":"Heading") + "=" + roundTo(progCmd.heading, 1) + ' @ ' + progTime + "; ";
				});
			} else if ( action.type == "wp" ) {
				action.values.map(function (waypoint) {
					lastCommand += "WP: " + formatPosition(waypoint.lat, waypoint.lon) + "; ";
				});
			}
		});
		return lastCommand;
	}

    function makeRaceStatusLine (r) {

        if ( r.curr == undefined ) {
            return "";
        } else {

            var autoSail = r.curr.tsEndOfAutoSail - r.curr.lastCalcDate;
            if ( autoSail < 0 ) {
                autoSail = '-';
            } else {
                autoSail = new Date(autoSail).toJSON().substring(11,19);
            }

            var sailNameBG = r.curr.badSail?"red":"lightgreen";
            var agroundBG = r.curr.aground?"red":"lightgreen";

            var manoeuvering = (r.curr.tsEndOfSailChange  > r.curr.lastCalcDate)
                || (r.curr.tsEndOfGybe  > r.curr.lastCalcDate)
                || (r.curr.tsEndOfTack > r.curr.lastCalcDate);

            var lastCommand = "";
            var lastCommandBG = "white";
            if ( r.lastCommand != undefined ) {
                // ToDo: error handling; multiple commands; expiring?
                var lcTime = new Date(r.lastCommand.request.ts).toJSON().substring(11,19);
				lastCommand = printLastCommand(r.lastCommand.request.actions);
                lastCommand = "T: " + lcTime + ' Actions: ' + lastCommand;
                if ( r.lastCommand.rc != "ok" ) {
                    lastCommandBG = 'red';
                }
            }

            var cards = "";
            var showCards = ["PR","WP"];
  //          for ( var key in r.curr.cards ) {
            for ( var key in showCards) {
                cards =  cards + " " + showCards[key] + ":" + r.curr.cards[showCards[key]];
            }

            var twaFG = (r.curr.twa < 0)?"red":"green";
            
            return "<tr>"
                + "<td>" + r.name + "</td>"
                + "<td>" + ((r.rank)?r.rank:"-") + "</td>"
                + "<td>" + formatPosition(r.curr.pos.lat, r.curr.pos.lon) + "</td>"
                + "<td>" + roundTo(r.curr.heading, 1) + "</td>"
                + "<td>" + roundTo(r.curr.tws, 1) + "</td>"
                + "<td>" + roundTo(r.curr.twd, 1) + "</td>"
                + "<td style=\"color:" + twaFG + ";\">" + roundTo(Math.abs(r.curr.twa), 1) + "</td>"
                + "<td>" + roundTo(r.curr.speed, 2) + "</td>"
                + "<td>" + (r.curr.twaAuto?"yes":"no") + "</td>"
                + "<td>" + roundTo(r.curr.distanceToEnd, 1) + "</td>"
                + "<td>" + ((r.curr.options.length == 8)?'Full':r.curr.options) + "</td>"
                + "<td>" + cards + "</td>"
                + "<td style=\"background-color:" + sailNameBG + ";\">" + sailNames[r.curr.sail] + "</td>"
                + "<td style=\"background-color:" + agroundBG +  ";\">" + ((r.curr.aground)?"AGROUND":"no") + "</td>"
                + "<td>" + ((r.curr.stealthMode > r.curr.lastCalcDate)?"yes":"no") + "</td>"
                + "<td>" + (manoeuvering?"yes":"no") + "</td>"
                + "<td style=\"background-color:" + lastCommandBG +  ";\">" + lastCommand + "</td>"
                + "</tr>";
        }
    }

    function makeRaceStatusHTML () {
        return "<table style=\"width:100%\">"
            + raceStatusHeader
            + races.map(makeRaceStatusLine).join(' ');
            + "</table>";
    }

    function makeTableHTML (r) {
        return "<table style=\"width:100%\">"
            + tableHeader
            + (r === undefined?"":r.tableLines.join(' '))
            + "</table>";
    }

    function formatSeconds (value) {
        if ( value < 0 ) {
            return "-";
        } else {
            return roundTo(value/1000, 0);
        }
    }
		
	function addTableCommandLine(r) {
		r.tableLines.unshift(
		  "<tr>"
		+ "<td>" + new Date(r.lastCommand.request.ts).toGMTString() + "</td>" 
		+ '<td colspan="2">Command @' + new Date().toJSON().substring(11,19) + "</td>" 
		+ '<td colspan="13">Actions: ' + printLastCommand(r.lastCommand.request.actions) + "</td>" 
		+ "</tr>");
        if (r.id == selRace.value) {
            divRecordLog.innerHTML = makeTableHTML(r);
        }
	}
    
    function makeTableLine (r) {

        var autoSail = r.curr.tsEndOfAutoSail - r.curr.lastCalcDate;
        if ( autoSail < 0 ) {
            autoSail = '-';
        } else {
            autoSail = new Date(autoSail).toJSON().substring(11,19);
        }

        var sailChange = formatSeconds(r.curr.tsEndOfSailChange - r.curr.lastCalcDate);
        var gybing = formatSeconds(r.curr.tsEndOfGybe - r.curr.lastCalcDate);
        var tacking = formatSeconds(r.curr.tsEndOfTack - r.curr.lastCalcDate);

        var twaFG = (r.curr.twa < 0)?"red":"green";

        return "<tr>"
            + "<td>" + new Date(r.curr.lastCalcDate).toGMTString() + "</td>"
            + "<td>" + formatPosition(r.curr.pos.lat, r.curr.pos.lon) + "</td>"
            + "<td>" + roundTo(r.curr.heading, 1) + "</td>"
            + "<td>" + roundTo(r.curr.tws, 1) + "</td>"
            + "<td>" + roundTo(r.curr.twd, 1) + "</td>"
            + "<td style=\"color:" + twaFG + ";\">" + roundTo(Math.abs(r.curr.twa), 1) + "</td>"
            + "<td>" + roundTo(r.curr.speed, 2) + "</td>"
            + "<td>" + roundTo(r.curr.speedC, 2) + "</td>"
            + "<td>" + r.curr.speedT + "</td>"
            + "<td>" + roundTo(r.curr.deltaD, 2) + "</td>"
            + "<td>" + roundTo(r.curr.deltaT, 0) + "</td>"
            + "<td>" + autoSail + "</td>"
            + "<td>" + (r.curr.twaAuto?"yes":"no") + "</td>"
            + "<td>" + sailChange + "</td>"
            + "<td>" + gybing + "</td>"
            + "<td>" + tacking + "</td>"
            + "</tr>";
    }

    function saveMessage (r) {
        var newRow = makeTableLine(r);
        r.tableLines.unshift(newRow);
        if (r.id == selRace.value) {
            divRecordLog.innerHTML = makeTableHTML(r);
        }
    }

    function changeRace() {
        divRecordLog.innerHTML = makeTableHTML(races[this.value]);
    }

    function enableRace(id) {
        for (var i = 0; i < selRace.options.length; i++) {
            if (selRace.options[i].value == id) {
                selRace.options[i].disabled = false;
                if (selRace.selectedIndex == -1) {
                    selRace.selectedIndex = i;
                }
            }
        }
    }

    function disableRaces() {
        for (var i = 0; i < selRace.options.length; i++) {
            selRace.options[i].disabled = true;
        }
        selRace.selectedIndex == -1;
    }
    
    function addRace(message) {
        var raceId = message._id.race_id;
        var race = { id: raceId, name : "Race #" + raceId, tableLines: []};
        races[raceId] = race;
        addSelOption(race, false, false); 
        return races[raceId];
    }
    
    function updatePosition (message, r) {
        "use strict";
        if (r === undefined) { // race not lsited
            r = addRace(message);
        }
        
        if (r.curr !== undefined && r.curr.lastCalcDate == message.lastCalcDate) { // repeated message
            return;
        }
        if (!r.curr) {
            enableRace(r.id);
        }
        r.prev = r.curr;
        r.curr = message;
        r.curr.speedT =  theoreticalSpeed(message);
        if ( r.prev != undefined ) {
            r.curr.deltaD = gcDistance(r.prev.pos.lat, r.prev.pos.lon, r.curr.pos.lat, r.curr.pos.lon);
            // Epoch timestamps are milliseconds since 00:00:00 UTC on 1 January 1970.
            r.curr.deltaT = (r.curr.lastCalcDate - r.prev.lastCalcDate)/1000;
            r.curr.speedC = roundTo(r.curr.deltaD/r.curr.deltaT * 3600, 2);
            saveMessage(r);
        }
        divRaceStatus.innerHTML = makeRaceStatusHTML();
    }

    function theoreticalSpeed (message) {
        var boatPolars = polars[message.boat.polar_id];
        if ( boatPolars == undefined ) {
            return '-';
        } else {
            var tws = message.tws;
            var twd = message.twd;
            var twa = message.twa;
            var options = message.options;
            var foil = foilingFactor(options, tws, twa, boatPolars.foil);
            var hull = options.includes("hull")?1.003:1.0;
            var twsLookup = fractionStep(tws, boatPolars.tws);
            var twaLookup = fractionStep(twa, boatPolars.twa);
            var speed = maxSpeed(options, twsLookup, twaLookup, boatPolars.sail);
            return ' ' + roundTo(speed.speed * foil * hull, 2) + '(' + speed.sail + ')';
        }
    }

    function maxSpeed (options, iS, iA, sailDefs) {
        var maxSpeed = 0;
        var maxSail = "";
        for (const sailDef of sailDefs) {
            if ( sailDef.name === "JIB"
                 || sailDef.name === "SPI"
                 || (sailDef.name === "STAYSAIL" && options.includes("heavy"))
                 || (sailDef.name === "LIGHT_JIB" && options.includes("light"))
                 || (sailDef.name === "CODE_0" && options.includes("reach"))
                 || (sailDef.name === "HEAVY_GNK" && options.includes("heavy"))
                 || (sailDef.name === "LIGHT_GNK" && options.includes("light")) ) {
                var speeds = sailDef.speed;
                var speed = bilinear(iA.fraction, iS.fraction,
                                     speeds[iA.index - 1][iS.index - 1],
                                     speeds[iA.index][iS.index - 1],
                                     speeds[iA.index - 1][iS.index],
                                     speeds[iA.index][iS.index]);
                if ( speed > maxSpeed ) {
                    maxSpeed = speed;
                    maxSail = sailDef.name;
                }
            }
        }
        return {
            speed: maxSpeed,
            sail: maxSail
        }
    }

    function bilinear (x, y, f00, f10, f01, f11) {
        return f00 * (1 - x) * (1 - y)
            + f10 * x * (1 - y)
            + f01 * (1 - x) * y
            + f11 * x * y;
    }

    function foilingFactor (options, tws, twa, foil) {
        var speedSteps = [0, foil.twsMin - foil.twsMerge, foil.twsMin, foil.twsMax,  foil.twsMax + foil.twsMerge, Infinity];
        var twaSteps = [0, foil.twaMin - foil.twaMerge, foil.twaMin, foil.twaMax,  foil.twaMax + foil.twaMerge, Infinity];
        var foilMat = [[1, 1, 1, 1, 1, 1],
                       [1, 1, 1, 1, 1, 1],
                       [1, 1, foil.speedRatio, foil.speedRatio, 1, 1],
                       [1, 1, foil.speedRatio, foil.speedRatio, 1, 1],
                       [1, 1, 1, 1, 1, 1],
                       [1, 1, 1, 1, 1, 1]];
        
        if ( options.includes("foil") ) {
            var iS = fractionStep(tws, speedSteps);
            var iA = fractionStep(twa, twaSteps);
            return  bilinear(iA.fraction, iS.fraction,
                             foilMat[iA.index - 1][iS.index - 1],
                             foilMat[iA.index][iS.index - 1],
                             foilMat[iA.index - 1][iS.index],
                             foilMat[iA.index][iS.index]);
        } else {
            return 1.0;
        }
    }
    
    function fractionStep (value, steps) {
        var absVal = Math.abs(value);
        var index = 0;
        while ( index < steps.length && steps[index]<= absVal ) {
            index++;
        }
        return {
            index: index,
            fraction: (absVal - steps[index-1]) / (steps[index] - steps[index-1])
        }
    }
    
    function callUrlZezo (raceId, beta) {
        var baseURL = 'http://zezo.org';
        var r = races[raceId]; 
        var urlBeta = r.url + (beta?"b":"");

        var url = baseURL + '/' + urlBeta + '/chart.pl?lat=' + r.curr.pos.lat + '&lon=' + r.curr.pos.lon;
        window.open(url, cbReuseTab.checked?urlBeta:'_blank');
    }
    
    // Greate circle distance in meters
    function gcDistance (lat0, lon0, lat1, lon1) {
        // e = r · arccos(sin(φA) · sin(φB) + cos(φA) · cos(φB) · cos(λB – λA))
        var rlat0 = toRad(lat0);
        var rlat1 = toRad(lat1);
        var rlon0 = toRad(lon0);
        var rlon1 = toRad(lon1);
        return radius * Math.acos(Math.sin(rlat0) * Math.sin(rlat1)
                                  + Math.cos(rlat0) * Math.cos(rlat1) * Math.cos(rlon1 - rlon0));
    }

    function toRad (angle) {
        return angle / 180 * Math.PI;
    }
    
    function toDeg (number) {
        var u = sign(number);
        number = Math.abs(number);
        var g = Math.floor(number);
        var frac = number - g;
        var m = Math.floor(frac * 60);
        frac = frac - m/60;
        var s = Math.floor(frac * 3600);
        var cs = roundTo(360000 * (frac - s/3600), 0);
        while ( cs >= 100 ) {
            cs = cs - 100;
            s = s + 1;
        }
        return {"u":u, "g":g, "m":m, "s":s, "cs":cs};
    }
    
    function roundTo (number, digits) {
        var scale = Math.pow(10, digits);
        return Math.round(number * scale) / scale;
    }

    function sign (x) {
        return (x < 0)? -1: 1;
    }

    function formatPosition (lat, lon) {
        var latDMS = toDeg(lat);
        var lonDMS = toDeg(lon);
        var latString = latDMS.g + "°" + latDMS.m + "'" + latDMS.s + "\"";
        var lonString = lonDMS.g + "°" + lonDMS.m + "'" + lonDMS.s + "\"";
        return  latString + ((latDMS.u==1)?'N':'S') + ' ' + lonString + ((lonDMS.u==1)?'E':'W');
    }

    var initialize = function () {
        var manifest = chrome.runtime.getManifest();
        document.getElementById("lb_version").innerHTML = manifest.version;

        lbBoatname = document.getElementById("lb_boatname");
        selRace = document.getElementById("sel_race");
        cbRouter = document.getElementById("auto_router");
        cbReuseTab = document.getElementById("reuse_tab");
        lbRace = document.getElementById("lb_race");
        lbCurTime = document.getElementById("lb_curtime");
        lbCurPos = document.getElementById("lb_curpos");
        lbHeading = document.getElementById("lb_heading");
        lbTWS = document.getElementById("lb_tws");
        lbTWD = document.getElementById("lb_twd");
        lbTWA = document.getElementById("lb_twa");
        lbDeltaD = document.getElementById("lb_delta_d");
        lbDeltaT = document.getElementById("lb_delta_t");
        lbSpeedC = document.getElementById("lb_curspeed_computed");
        lbSpeedR = document.getElementById("lb_curspeed_reported");
        lbSpeedT = document.getElementById("lb_curspeed_theoretical");
        divRaceStatus = document.getElementById("raceStatus");
        divRecordLog = document.getElementById("recordlog");
        divRecordLog.innerHTML = makeTableHTML();
        cbRawLog =  document.getElementById("cb_rawlog");
        divRawLog = document.getElementById("rawlog");
        callUrlFunction = callUrlZezo;
        initRaces();
        chrome.storage.local.get("polars", function(items) {
			if (items["polars"] !== undefined) {
            	console.log("Retrieved " + items["polars"].filter(function(value) { return value != null }).length + " polars."); 
            	polars = items["polars"];
			}
        });
        initialized = true;
    }
    
    var callUrl = function (raceId) {
        var beta = false;

        if (typeof raceId === "object") { // button event
            raceId = selRace.value;
            beta = selRace.options[selRace.selectedIndex].betaflag;
        } else { // new tab
            var race = selRace.options[selRace.selectedIndex];
            if (race && race.value == raceId) {
                beta = race.betaflag;
            }
        }  
        if ( races[raceId].url === undefined) {
            alert('Unsupported race #' + raceId);
        } else if ( races[raceId].curr === undefined ) {
            alert('No position received yet. Please retry later.');
        } else if ( callUrlFunction === undefined ) {
            // ?
        } else {
            callUrlFunction(raceId, beta);
        }
    }

    function reInitUI (newId) {
        if ( currentUserId != undefined && currentUserId != newId ) {
            // Re-initialize statistics
            disableRaces();
            races.map(function (race) {
                race.tableLines = [];
                race.curr = undefined;
                race.prev = undefined;
                race.lastCommand = undefined;
                race.rank = undefined;
            });
            divRaceStatus.innerHTML = makeRaceStatusHTML();
            divRecordLog.innerHTML = makeTableHTML();
        };
    }
    

    var onEvent = function (debuggeeId, message, params) {
        if ( tabId != debuggeeId.tabId )
            return;

        if ( message == "Network.webSocketFrameSent" ) {
            // Append message to raw log
            if ( cbRawLog.checked ) {
                divRawLog.innerHTML = divRawLog.innerHTML + '\n' + '>>> ' + params.response.payloadData;
            }

            // Map to request type via requestId
            var request = JSON.parse(params.response.payloadData);
            requests.set(request.requestId, request);
            
        } else if ( message == "Network.webSocketFrameReceived" ) {
            // Append message to raw log
            if ( cbRawLog.checked ) {
                divRawLog.innerHTML = divRawLog.innerHTML + '\n' +  '<<< ' + params.response.payloadData;
            }
            
            var response = JSON.parse(params.response.payloadData);
            if ( response == undefined ) {
                console.log("Invalid JSON in payload");
            } else {
                var responseClass = response["@class"];
                if ( responseClass == ".AuthenticationResponse" ) {
                    reInitUI(response.userId);
                    currentUserId = response.userId;
                    lbBoatname.innerHTML = response.displayName;
                } else if ( responseClass == ".LogEventResponse" ) {
                    // Get the matching request and Dispatch on request type
                    var request = requests.get(response.requestId);
                    
                    // Dispatch on request type                 
                    if ( request == undefined ) {
                        // Probably only when debugging.
                        // -- save and process later?
                        console.warn(responseClass + " " + response.requestId + " not found");
                    } else if ( request.eventKey == "LDB_GetLegRank" ) {
                        // Use this response to update User/Boat info if the plugin is switched on while already logged in
                        reInitUI(response.scriptData.me._id );
                        currentUserId = response.scriptData.me._id;
                        lbBoatname.innerHTML = response.scriptData.me.displayName;
                        // Retrieve rank in current race
                        var raceId = request.race_id;
                        var race = races[raceId];
                        if ( race != undefined ) {
                            race.rank = response.scriptData.me.rank;
                            divRaceStatus.innerHTML = makeRaceStatusHTML();
                        }
                    } else if ( request.eventKey == "Leg_GetList" ) {
                        // Contains destination coords, ice limits
                        // ToDo: contains Bad Sail warnings. Show in race status table?
                        var legInfos = response.scriptData.res;
                        legInfos.map(function (legInfo) {
                            var race = races[legInfo.raceId];
                            if ( race != undefined ) {
                                race.rank = legInfo.rank;
                                if ( legInfo.problem == "badSail" ) {
                                } else if ( legInfo.problem == "..." ) {
                                }
                            }
                        });
                        divRaceStatus.innerHTML = makeRaceStatusHTML();
                    } else if ( request.eventKey == "Game_GetBoatState" ) {
                        // First boat state message, only sent for the race the UI is displaying
                        var raceId = response.scriptData.boatState._id.race_id;
                        updatePosition(response.scriptData.boatState, races[raceId]);
                        if (cbRouter.checked) {
                            callUrl(raceId);
                        }
                    } else if ( request.eventKey == "Game_AddBoatAction" ) {
                        // First boat state message, only sent for the race the UI is displaying
                        var raceId = request.race_id;
                        var race = races[raceId];
                        if ( race != undefined ) {
                            race.lastCommand = {request: request, rc: response.scriptData.rc};
							addTableCommandLine(race);
                            divRaceStatus.innerHTML = makeRaceStatusHTML();
                        }
                    } else if ( request.eventKey == "Meta_GetPolar" ) {
                        if ( polars[response.scriptData.polar._id] == undefined ) {
                            polars[response.scriptData.polar._id] = response.scriptData.polar;
                            chrome.storage.local.set({"polars": polars});
                            console.info("Stored new polars " + response.scriptData.polar.label);
                        } else {
                            console.info("Known polars " + response.scriptData.polar.label);
                        }
                    }
                } else if ( responseClass == ".ScriptMessage" ) {
                    // There is no request for .ScriptMessages.
                    // The only ScriptMessage type is extCode=boatStatePush
                    updatePosition(response.data, races[response.data._id.race_id]);
                }
            }
        }
    }

    return {
        // The only point of initialize is to wait until the document is constructed.
        initialize: initialize,
        // Useful functions
        callUrl: callUrl,
        changeRace: changeRace,
        onEvent: onEvent
    }
} ();


var tabId = parseInt(window.location.search.substring(1));


window.addEventListener("load", function() {

    controller.initialize();
    
    document.getElementById("bt_callurl").addEventListener("click", controller.callUrl);
    document.getElementById("sel_race").addEventListener("change", controller.changeRace);
    
    chrome.debugger.sendCommand({tabId:tabId}, "Network.enable", function() {
        // just close the dashboard window if debugger attach fails
        // wodks on session restore too
        
        if (chrome.runtime.lastError) {
            window.close();
            return;
        }
    });
    chrome.debugger.onEvent.addListener(controller.onEvent);
});

window.addEventListener("unload", function() {
    chrome.debugger.detach({tabId:tabId});
});
