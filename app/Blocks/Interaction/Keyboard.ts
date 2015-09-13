import PreEffect = require("../Effects/PreEffect");
import ISource = require("../ISource");
import Grid = require("../../Grid");
import AudioChain = require("../../Core/Audio/Connections/AudioChain");
import Microphone = require("../Sources/Microphone");
import Power = require("../Power/Power");
import Voice = require("./VoiceObject");
import Granular = require("../Sources/Granular");
import SamplerBase = require("../Sources/SamplerBase");
import Recorder = require("../Sources/Recorder");

import IApp = require("../../IApp");

declare var App: IApp;

/**
 * Base class for mono, poly and midi keyboards
 */
class Keyboard extends PreEffect {

    public BaseFrequency: number;
    public KeysDown: any = {};

    Init(sketch?: any): void {
        super.Init(sketch);
    }

    Draw() {
        super.Draw();
    }

    UpdateConnections(chain: AudioChain) {
        super.UpdateConnections(chain);

        chain.Sources.forEach((source: ISource) => {
            this.SetBaseFrequency(source);
            this.KeysDown = {};

            // Check to see if we have enough sources on this block
            if ((source.Sources.length === 1) && (this.Params.isPolyphonic)) {
                // Create extra polyphonic voices
                this.CreateVoices(source);
            }
        });
    }

    Dispose(){
        this.KeysDown = null;
        this.BaseFrequency = null;
    }

    SetParam(param: string,value: number) {
        super.SetParam(param,value);

        if (param == "glide") {
            value = value/100;
        }
        else if (param == "octave") {
            for (let i = 0, source: ISource; i < this.Connections.Count; i++) {
                source = this.Connections.GetValueAt(i);
                let diff: number = value - this.Params.octave;
                source.OctaveShift(diff);
            }
        }
        else if (param === 'polyphonic') {
            this.Params.isPolyphonic = value;
            // ALL SOURCES
            this.Chain.Sources.forEach((source: ISource) => {
                source.TriggerRelease('all');
                // Create extra polyphonic voices
                this.CreateVoices(source);
            });
            App.Audio.ConnectionManager.Update();
        }

        this.Params[param] = value;
    }

    CreateVoices(source: ISource){
        // Don't create if it's a Power or a Microphone
        if ((source instanceof Power) || (source instanceof Microphone)) return;

        // Work out how many voices we actually need (we may already have some)
        let diff: number = App.Config.PolyphonicVoices - source.Sources.length;

        // If we haven't got enough sources, create however many we need.
        if (diff > 0){

            // Loop through and create the voices
            for (let i = 1; i <= App.Config.PolyphonicVoices; i++) {

                // Create a source
                let s: Tone.Source = source.CreateSource();

                let e: Tone.AmplitudeEnvelope;

                // Create an envelope and save it to `var e`
                e = source.CreateEnvelope();

                if (e) {
                    // Connect the source to the Envelope and start
                    s.connect(e);
                    s.start();

                    // Connect Envelope to the Effects Chain
                    e.connect(source.AudioInput);
                } else {
                    // No CreateEnvelope()
                    // Check if it's a Sampler Source (they have their own envelopes built in)
                    if (source.Sources[0] instanceof Tone.Simpler) {
                        e = source.Sources[i].envelope;
                        s.connect(source.AudioInput)
                    }
                }

                // Add the source and envelope to our FreeVoices list
                source.FreeVoices.push( new Voice(i) );
            }
        }
    }


    public SetBaseFrequency(source:ISource){
        if (source.Params && source.Params.frequency){
            this.BaseFrequency = source.Params.frequency;
        } else {
            this.BaseFrequency = App.Config.BaseNote;
        }
    }

    public GetStartOctave(source): number {
        let octave: number;
        let note: string = source.Source.frequencyToNote(this.BaseFrequency);

        if (note.length === 3) {
            octave = parseInt(note.charAt(2));
        } else {
            octave = parseInt(note.charAt(1));
        }

        return octave;
    }

    /**
     * Gets the note string from the computer keyboard event keynote & octave string
     * @param keyCode
     * @returns {string}
     * @constructor
     */
    public GetKeyNoteOctaveString(keyCode): string {
        return (keyCode
            .replace('note_', '')
            .replace('_a', this.Params.octave)
            .replace('_b', this.Params.octave + 1)
            .replace('_c', this.Params.octave + 2)
            .replace('_d', this.Params.octave + 3)
            .toString());
    }

    /**
     * Gets the frequency from a note string and multiplies by any pitch increments
     * @param note
     * @param source
     * @returns {number}
     * @constructor
     */
    public GetFrequencyOfNote(note, source:ISource): number {
        if (source.Params.baseFrequency || source.Params.fine) {
            return source.Sources[0].noteToFrequency(note) *
                App.Audio.Tone.intervalToFrequencyRatio(source.Params.baseFrequency + source.Params.fine); //TODO - keyboards and other controllers should be dumber than this, not needing to know about block specific frequency modifiers
        } else if (source instanceof SamplerBase) {
            return source.Sources[0].noteToFrequency(note) * source.Params.playbackRate;
        } else {
            return source.Sources[0].noteToFrequency(note);
        }
    }

    /**
     * Turns midi velocity information into a number 0 - 1 for gain
     * @param velocity
     * @returns {number}
     * @constructor
     */
    MidiVelocityToGain(velocity){
        return velocity/127;
    }

}

export = Keyboard;