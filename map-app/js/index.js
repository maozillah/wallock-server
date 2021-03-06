/* jshint quotmark: false, unused: vars, browser: true */
/* global cordova, console, $, bluetoothSerial, _, refreshButton, deviceList, previewColor, red, green, blue, disconnectButton, connectionScreen, colorScreen, rgbText, messageDiv */
'use strict';

var prox = false;
var fenceX = 43.470151;
var fenceY = -79.701940; //hardcoded
var stop = false;
var pos = {
    lat: 0,
    lng: 0
};
var clickPos, savedLocations, marker;
// HAS TO BE HTTPS
var serverURL = "https://e2e5ab59.ngrok.io/";
var unlocked = true;
// var unlocked = false;

/***************************************************

Gotta load up saved locations from server beforehand

***************************************************/
// $( "#saveLocation" ).hide();

if (navigator.geolocation) {
    navigator.geolocation.watchPosition(showPosition); //check if user has moved on position change
}

function loadDataFromServer() {
    $.ajax({
        url: serverURL + "api/comments",
        dataType: 'json',
        cache: false,
        success: function(data) {
            savedLocations = data;

            console.log("loaded data from server");
            // initiate map once locations have been retrieved
            app.loadMap();
        }.bind(this),
        error: function(xhr, status, err) {
            console.error("/api/comments", status, err.toString());
        }.bind(this)
    });
}

function showPosition(position) {

    pos = {
       
        lat: position.coords.latitude,
       lng: position.coords.longitude

       // lat: 43.4675599,
       // lng: -79.6919376
    };

    $.ajax({
        method: "POST",
        url: serverURL+"api/checkLocation",
        dataType: 'json',
        data: {
            currentLat: pos.lat,
            currentLong: pos.lng
        }
    })
    .done(function(danger) {
        console.log ("near danger location? " + danger);
        // console.log("first unlocked =" + unlocked);

        // near danger location
        // unlocked = true, danger = true
        if (danger==true && unlocked==true) {
            console.log("lock wallet");

            //lock
            bluetoothSerial.write("a");
            unlocked = false;

            // console.log(unlocked);

            window.location.href = "#locked";
        } 

        if (unlocked==false && danger==false) {
            console.log("unlock wallet");

            //unlock
            bluetoothSerial.write("b");
            unlocked = true;
            window.location.href = "#unlocked";
        };
    });

    console.log(pos.lat + " " + pos.lng);
    console.log("unlocked =" + unlocked);
}

function initMap(latitude, longitude) {

    var bounds = new google.maps.LatLngBounds();

    var myLatlng = {
        lat: latitude,
        lng: longitude
    };

    var map = new google.maps.Map(document.getElementById('map'), {
        zoom: 13,
        center: myLatlng,
        disableDefaultUI: true
    });

    var infoWindow = new google.maps.InfoWindow(),
        marker, i;


    // add saved location markers to map
    $.each(savedLocations, function(i, value) {

        var position = new google.maps.LatLng(value.lat, value.long);
        bounds.extend(position);

        marker = new google.maps.Marker({
            position: position,
            map: map,
            title: value.locName
        });

        google.maps.event.addListener(marker, 'click', (function(marker, i) {
            return function() {
                infoWindow.setContent(value.locName);
                infoWindow.open(map, marker);
            }
        })(marker, i));

        // Automatically center the map fitting all markers on the screen
        map.fitBounds(bounds);
    });

    map.addListener('click', function(event) {
        clickPos = {
            lat: event.latLng.lat(),
            lng: event.latLng.lng()
        }

        var marker = new google.maps.Marker({
            position: clickPos,
            map: map
        });

        // show location name input field
        app.showLocation();
        $('#locName').val("");

        // marker.addListener('click', function(event) {
            /*************************************
            CODE THAT REMOVES LOCATION FROM SERVER
            marker.getPosition().lat() and marker.getPosition().lng()
            Removing a location the marker coords instead because click may not be exact
            *************************************/

            // display marker name

        //     marker.setMap(null);
        // });
    });
}

var app = {
    initialize: function() {
        this.bind();
    },
    bind: function() {
        document.addEventListener('deviceready', this.deviceready, false);
        colorScreen.hidden = true;
    },
    deviceready: function() {
        deviceList.ontouchstart = app.connect;
        refreshButton.ontouchstart = app.list;
        // disconnectButton.ontouchstart = app.disconnect;

        // var throttledOnColorChange = _.throttle(app.onColorChange, 200);
        // $('input').on('change', throttledOnColorChange);

        app.list();
    },
    list: function(event) {
        deviceList.firstChild.innerHTML = "Discovering...";
        app.setStatus("Looking for Bluetooth Devices...");

        bluetoothSerial.list(app.ondevicelist, app.generateFailureFunction("List Failed"));
    },
    connect: function(e) {
        app.setStatus("Connecting...");
        var device = e.target.getAttribute('deviceId');
        console.log("Requesting connection to " + device);
        bluetoothSerial.connect(device, app.onconnect, app.ondisconnect);
    },
    disconnect: function(event) {
        if (event) {
            event.preventDefault();
        }

        app.setStatus("Disconnecting...");
        bluetoothSerial.disconnect(app.ondisconnect);
    },
    onconnect: function() {
        connectionScreen.hidden = true;
        colorScreen.hidden = false;
        app.setStatus("Connected.");

        // loadDataFromServer();

        // LocNameForm.hidden = true;
    },
    loadMap: function() {
        if (!(pos.lat == 0 && pos.lng == 0)) {
            initMap(pos.lat, pos.lng);
            console.log("Current location detected. Initializing map");
        } else {
            setTimeout(function() {
                app.loadMap();
            }, 1000);
            console.log("Timeout. is location services on?");
        }
    },
    ondisconnect: function() {
        connectionScreen.hidden = false;
        colorScreen.hidden = true;
        app.setStatus("Disconnected.");
    },
    showLocation: function(event) {
        if (event) {
            event.preventDefault();
        }

        // LocNameForm.hidden = false;
    },
    saveLocation: function() {
        var locName = $('#locName').val();

        $.ajax({
            method: "POST",
            url: serverURL + "api/comments",
            dataType: 'json',
            data: {
                locName: locName,
                lat: clickPos.lat,
                long: clickPos.lng
            }
        })
            .done(function(msg) {
                console.log("Data Saved: " + msg);
                alert("Location Saved!");

                $('#locName').val('');
            })
            .fail(function() {
                console.log("error");
            });

        console.log(locName + " " + clickPos.lat + " " + clickPos.lng);

        loadDataFromServer();
        // LocNameForm.hidden = true;
    },
    timeoutId: 0,
    setStatus: function(status) {
        if (app.timeoutId) {
            clearTimeout(app.timeoutId);
        }
        messageDiv.innerText = status;
        app.timeoutId = setTimeout(function() {
            messageDiv.innerText = "";
        }, 4000);
    },
    ondevicelist: function(devices) {
        var listItem, deviceId;

        // remove existing devices
        deviceList.innerHTML = "";
        app.setStatus("");

        devices.forEach(function(device) {
            listItem = document.createElement('li');
            listItem.className = "topcoat-list__item";
            if (device.hasOwnProperty("uuid")) { // TODO https://github.com/don/BluetoothSerial/issues/5
                deviceId = device.uuid;
            } else if (device.hasOwnProperty("address")) {
                deviceId = device.address;
            } else {
                deviceId = "ERROR " + JSON.stringify(device);
            }
            listItem.setAttribute('deviceId', device.address);
            listItem.innerHTML = device.name + "<br/><i>" + deviceId + "</i>";
            deviceList.appendChild(listItem);
        });

        if (devices.length === 0) {

            if (cordova.platformId === "ios") { // BLE
                app.setStatus("No Bluetooth Peripherals Discovered.");
            } else { // Android
                app.setStatus("Please Pair a Bluetooth Device.");
            }

        } else {
            app.setStatus("Found " + devices.length + " device" + (devices.length === 1 ? "." : "s."));
        }
    },
    generateFailureFunction: function(message) {
        var func = function(reason) {
            var details = "";
            if (reason) {
                details += ": " + JSON.stringify(reason);
            }
            app.setStatus(message + details);
        };
        return func;
    }
};