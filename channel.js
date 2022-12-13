(function() {
    'use strict';
    var Channel = function (o) {
        var self = this;

        // Throw an error if no source is provided.
        if (o.id === undefined) {
            console.error('Require an id for the channel');
            return;
        }
        self.init_channel(o);
    };

    Channel.prototype = {
        init_channel: function(o) {
            var self = this;
            self._id = o.id;
            self.init(o);
            self._elementFormat = (typeof o.elementFormat === 'function') ? o.elementFormat : function(id, name){return `#channels-${id}-${name}`;};

            self._random = o.random || false;
            self._randomCount = o.randomCount || 1;
            self._randomInterval = o.randomInterval || 60;
            self._crossfade = o.crossfade || false;
            self._playFor = o.playFor || undefined
            self._skipFront = o.skipFront || 0;
            self._fadeIn =   o.fadeIn || 0;
            self._fadeOut =  o.fadeOut || 0;
            self._pausetime = o.pausetime || 0;
            self._offset = o.offset || 0;
            self._timeouts = {};
            self.on('end', function(soundid){self._onEnd(soundid);});
            self.on('load', function(){self._onLoad();});
            return self;
        },
        id: function(){
            var self = this;
            return this._id;
        },
        _getElement: function(name){
            var self = this;
            return $(self._elementFormat(self._id, name));
        },
        sprite: function(sprite){
            var self = this;
            var defaultsprite = {'__default': [0, self.duration()*1000]};
            var sprites = {
                ...sprite,
                ...defaultsprite
            };
            self._sprite  = sprites;
        },
        random: function(active, count, interval){
            var self = this;
            self._random = active;
            self._randomCount = count;
            self._randomInterval = interval;
            if (self._random){
                self._generateRandomTimers();
            }
            if (self.playing()){
                self.stop();
                self.play();
            }
        },
        crossfade: function(active){
            var self = this;
            self._crossfade = active;
            if (self.playing()){
                self.stop();
                self.play();
            }
        },
        fadeIn: function(active){
            var self = this;
            self._fadeIn = active;
        },
        fadeOut: function(active){
            var self = this;
            self._fadeOut = active;
        },
        playFor: function(time){
            var self = this;
            if (typeof time === 'boolean'){
                self._playFor = self.duration()*1000;
            }else{
                self._playFor = Math.min(time, self.duration()*1000);
            }
            self._updateSprite();
        },
        skipFront: function(time){
            var self = this;
            if (typeof time === 'boolean'){
                self._skipFront = 0;
            }else{
                self._skipFront = Math.min(time, self.duration()*1000);
            }
            self._updateSprite();
        },
        pausetime: function(time){
            var self = this;
            self._pausetime = time;
        },
        offset: function(time){
            var self = this;
            self._offset = time;
        },
        play: function(){
            var self = this;
            if (self._random){
                self.loop(false);
                self._generateRandomTimers();
                self._setRandomPlayTimer();
            }else if(self._crossfade){
                // play sound in overlapping loop
                var startdelayed = self._offset;
                setTimeout(function(){
                    self._crossFade();
                }, startdelayed);
            }else{
                // play sound in loop
                var startdelayed = self._offset;
                setTimeout(function(){
                    var soundId = Howl.prototype.play.call(self, 'looped');
                    self._startFade(soundId);
                    self._endFade(soundId);
                }, startdelayed);
            }

        },
        _updateSprite: function(){
            var self = this;
            if (typeof self._skipFront === 'undefined' || typeof self._skipFront === 'boolean' || isNaN(self._skipFront)){
                self._skipFront = 0;
            }
            if (typeof self._playFor === 'undefined' || self._playFor <= 0 || isNaN(self._playFor)){
                self._playFor = self.duration()*1000 - self._skipFront;
            }
            self.sprite({ 'looped': [self._skipFront, self._playFor, true], 'once': [self._skipFront, self._playFor, true]  })
            if (self.playing()){
                self.stop();
                self.play();
            }
        },
        _onLoad: function(){
            var self = this;
            self._updateSprite();
        },
        _onEnd: function(soundId){
            var self = this;
            if (self._random || self._crossfade){
                return;
            }
            var fading = function(){
                self._startFade(soundId);
                self._endFade(soundId);
            }
            if (self._pausetime !== false && self._pausetime > 0){
                // pause playing for pausetime, and start fade
                self.pause(soundId);
                self._timeouts.pausetime = setTimeout(function(){
                    self.play(soundId);
                    self._startFade(soundId);
                    self._endFade(soundId);
                }, self._pausetime);
            }else{
                // start fades
                self._startFade(soundId);
                self._endFade(soundId);
            }
        },
        _getFadeOutTime: function(min=0){
            var self = this;
            var fadeOutFor = (self._fadeOut !== false)?self._fadeOut:min;
            if(fadeOutFor <= 0){
                return 0;
            }
            var startTime = (typeof self._playFor === 'undefined' || self._playFor == 0)? self.duration()*1000 : self._playFor;
            startTime -= fadeOutFor;
            return startTime;
        },
        _crossFade: function(){
            var self = this;
            var soundId = Howl.prototype.play.call(this, 'once');
            self._startFade(soundId, 1000);
            self._endFade(soundId, 1000);
            var crossfadeTime = self._getFadeOutTime(min);
            self._timeouts.crossfade = setTimout(function(){
                self._crossfade();
            }, crossfadeTime);
        },
        _startFade: function(soundId, min=0){
            var self = this;
            var fadeInFor = (self._fadeIn !== false)?self._fadeIn:min;
            if(fadeInFor > 0){
                self.fade(0, self.volume(), fadeInFor, soundId);
            }
        },
        _endFade: function(soundId, min=0){
            var self = this;
            var fadeoutTime = self._getFadeOutTime(min);
            if(fadeoutTime > 0){
                self._timeouts.fadeOut = setTimeout(function(){
                    self.fade(self.volume(), 0, self._fadeOut, soundId);
                }, fadeoutTime);
            }
        },
        _playWithFade: function(){
            var self = this;
            var soundId = Howl.prototype.play.call(this, 'once');
            self._startFade(soundId);
            self._endFade(soundId);
        },
        _getRandomInts: function(max, count = 1) {
            var max = Math.floor(max);
            var result = [];
            for (var i = 0; i < count; i++) {
                result.push(Math.floor(Math.random() * max));
            }
            function compareNumbers(a, b) {
                return a - b;
            }
            return result.sort(compareNumbers);
        },
        _generateRandomTimers: function(){
            var self = this;
            var randomTimers = self._getRandomInts(self._randomInterval, self._randomCount)
            self._randomTimer = []
            randomTimers.push(self._randomInterval + randomTimers[0])
            randomTimers.unshift(0)
            for (var i = 0; i < randomTimers.length - 1; i++) {
                self._randomTimer.push(randomTimers[i + 1] - randomTimers[i]);
            }
            self._randomIndex = undefined;
            self._randomFirst = self._randomTimer.shift(0)
        },
        _setRandomPlayTimer: function(){
            var self = this;
            var currentRandomIndex = Math.min(self._randomIndex || 0, self._randomTimer.length -1);
            if (self._randomIndex === undefined){
                currentRandomIndex = -1
                var timeout = self._randomFirst;
            }else{
                var currentRandomIndex = Math.min(self._randomIndex || 0, self._randomTimer.length -1);
                var timeout = self._randomTimer[currentRandomIndex];
            }
            self._randomIndex = (currentRandomIndex + 1)%self._randomTimer.length;
            self._timeouts.random = setTimeout(function(){
                self._setRandomPlayTimer();
                self._playWithFade();
            }, timeout);
        },
        stop: function(){
            var self = this;
            var soundId = Howl.prototype.stop.call(self);
            for (const value of Object.values(self._timeouts)) {
                clearTimeout(value);
            }
            self._timeouts = {};
        }

    };

    Object.setPrototypeOf(
        Channel.prototype,
        Howl.prototype,
    );

    // Add support for AMD (Asynchronous Module Definition) libraries such as require.js.
    if (typeof define === 'function' && define.amd) {
        define([], function() {
            return {
                Channel: Channel,
            };
        });
    }

    // Add support for CommonJS libraries such as browserify.
    if (typeof exports !== 'undefined') {
        exports.Channel = Channel;
    }

    // Add to global in Node.js (for testing, etc).
    if (typeof global !== 'undefined') {
        global.Channel = Channel;
    } else if (typeof window !== 'undefined') {  // Define globally in case AMD is not available or unused.
        window.Channel = Channel;
    }
})();
