type Delay = [Float32Array, number, number, number];

function createDelay(length: number, sampleRate: number): Delay {
  let len = Math.round(length * sampleRate);
  let nextPow2 = 2 ** Math.ceil(Math.log2(len));
  // buffer, write, read, mask
  return [new Float32Array(nextPow2), len - 1, 0 | 0, nextPow2 - 1];
}

// Code taken from: https://github.com/khoin/DattorroReverbNode
class DattorroReverb extends AudioWorkletProcessor {
  private _pDLength: any;
  private _preDelay: Float32Array;
  private _pDWrite: number;
  private _lp1: number;
  private _lp2: number;
  private _lp3: number;
  private _excPhase: number;
  private _taps: Int16Array;
  private _Delays: Delay[];
  sampleRate: number;

  static get parameterDescriptors() {
    return [
      ["preDelay", 0, 0, sampleRate - 1, "k-rate"],
      ["bandwidth", 0.9999, 0, 1, "k-rate"],
      ["inputDiffusion1", 0.75, 0, 1, "k-rate"],
      ["inputDiffusion2", 0.625, 0, 1, "k-rate"],
      ["decay", 0.5, 0, 1, "k-rate"],
      ["decayDiffusion1", 0.7, 0, 0.999999, "k-rate"],
      ["decayDiffusion2", 0.5, 0, 0.999999, "k-rate"],
      ["damping", 0.005, 0, 1, "k-rate"],
      ["excursionRate", 0.5, 0, 2, "k-rate"],
      ["excursionDepth", 0.7, 0, 2, "k-rate"],
      ["wet", 1.0, 0, 1, "k-rate"],
      ["dry", 0.0, 0, 1, "k-rate"],
    ].map(
      (x) =>
        new Object({
          name: x[0],
          defaultValue: x[1],
          minValue: x[2],
          maxValue: x[3],
          automationRate: x[4],
        })
    );
  }

  constructor(options: any) {
    super();

    this.sampleRate = sampleRate;

    this._pDLength = sampleRate + (128 - (sampleRate % 128)); // Pre-delay is always one-second long, rounded to the nearest 128-chunk
    this._preDelay = new Float32Array(this._pDLength);
    this._pDWrite = 0;
    this._lp1 = 0.0;
    this._lp2 = 0.0;
    this._lp3 = 0.0;
    this._excPhase = 0.0;

    this._Delays = [
      0.004771345, 0.003595309, 0.012734787, 0.009307483, 0.022579886,
      0.149625349, 0.060481839, 0.1249958, 0.030509727, 0.141695508,
      0.089244313, 0.106280031,
    ].map((x) => createDelay(x, sampleRate));

    this._taps = Int16Array.from(
      [
        0.008937872, 0.099929438, 0.064278754, 0.067067639, 0.066866033,
        0.006283391, 0.035818689, 0.011861161, 0.121870905, 0.041262054,
        0.08981553, 0.070931756, 0.011256342, 0.004065724,
      ],
      (x) => Math.round(x * sampleRate)
    );
  }

  writeDelay(index: number, data: number) {
    return (this._Delays[index][0][this._Delays[index][1]] = data);
  }

  readDelay(index: number) {
    return this._Delays[index][0][this._Delays[index][2]];
  }

  readDelayAt(index: number, i: number) {
    let d = this._Delays[index];
    return d[0][(d[2] + i) & d[3]];
  }

  // cubic interpolation
  // O. Niemitalo: https://www.musicdsp.org/en/latest/Other/49-cubic-interpollation.html
  readDelayCAt(index: number, i: number) {
    let d = this._Delays[index],
      frac = i - ~~i,
      int = ~~i + d[2] - 1,
      mask = d[3];

    let x0 = d[0][int++ & mask],
      x1 = d[0][int++ & mask],
      x2 = d[0][int++ & mask],
      x3 = d[0][int & mask];

    let a = (3 * (x1 - x2) - x0 + x3) / 2,
      b = 2 * x2 + x0 - (5 * x1 + x3) / 2,
      c = (x2 - x0) / 2;

    return ((a * frac + b) * frac + c) * frac + x1;
  }

  // First input will be downmixed to mono if number of channels is not 2
  // Outputs Stereo.
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: any
  ) {
    const pd = ~~parameters.preDelay[0],
      bw = parameters.bandwidth[0],
      fi = parameters.inputDiffusion1[0],
      si = parameters.inputDiffusion2[0],
      dc = parameters.decay[0],
      ft = parameters.decayDiffusion1[0],
      st = parameters.decayDiffusion2[0],
      dp = 1 - parameters.damping[0],
      ex = parameters.excursionRate[0] / sampleRate,
      ed = (parameters.excursionDepth[0] * sampleRate) / 1000,
      we = parameters.wet[0] * 0.6, // lo & ro both mult. by 0.6 anyways
      dr = parameters.dry[0];

    // write to predelay and dry output
    if (inputs[0].length == 2) {
      for (let i = 127; i >= 0; i--) {
        this._preDelay[this._pDWrite + i] =
          (inputs[0][0][i] + inputs[0][1][i]) * 0.5;

        outputs[0][0][i] = inputs[0][0][i] * dr;
        outputs[0][1][i] = inputs[0][1][i] * dr;
      }
    } else if (inputs[0].length > 0) {
      this._preDelay.set(inputs[0][0], this._pDWrite);
      for (let i = 127; i >= 0; i--)
        outputs[0][0][i] = outputs[0][1][i] = inputs[0][0][i] * dr;
    } else {
      this._preDelay.set(new Float32Array(128), this._pDWrite);
    }

    let i = 0 | 0;
    while (i < 128) {
      let lo = 0.0,
        ro = 0.0;

      this._lp1 +=
        bw *
        (this._preDelay[
          (this._pDLength + this._pDWrite - pd + i) % this._pDLength
        ] -
          this._lp1);

      // pre-tank
      let pre = this.writeDelay(0, this._lp1 - fi * this.readDelay(0));
      pre = this.writeDelay(
        1,
        fi * (pre - this.readDelay(1)) + this.readDelay(0)
      );
      pre = this.writeDelay(
        2,
        fi * pre + this.readDelay(1) - si * this.readDelay(2)
      );
      pre = this.writeDelay(
        3,
        si * (pre - this.readDelay(3)) + this.readDelay(2)
      );

      let split = si * pre + this.readDelay(3);

      // excursions
      // could be optimized?
      let exc = ed * (1 + Math.cos(this._excPhase * 6.28));
      let exc2 = ed * (1 + Math.sin(this._excPhase * 6.2847));

      // left loop
      let temp = this.writeDelay(
        4,
        split + dc * this.readDelay(11) + ft * this.readDelayCAt(4, exc)
      ); // tank diffuse 1
      this.writeDelay(5, this.readDelayCAt(4, exc) - ft * temp); // long delay 1
      this._lp2 += dp * (this.readDelay(5) - this._lp2); // damp 1
      temp = this.writeDelay(6, dc * this._lp2 - st * this.readDelay(6)); // tank diffuse 2
      this.writeDelay(7, this.readDelay(6) + st * temp); // long delay 2
      // right loop
      temp = this.writeDelay(
        8,
        split + dc * this.readDelay(7) + ft * this.readDelayCAt(8, exc2)
      ); // tank diffuse 3
      this.writeDelay(9, this.readDelayCAt(8, exc2) - ft * temp); // long delay 3
      this._lp3 += dp * (this.readDelay(9) - this._lp3); // damp 2
      temp = this.writeDelay(10, dc * this._lp3 - st * this.readDelay(10)); // tank diffuse 4
      this.writeDelay(11, this.readDelay(10) + st * temp); // long delay 4

      lo =
        this.readDelayAt(9, this._taps[0]) +
        this.readDelayAt(9, this._taps[1]) -
        this.readDelayAt(10, this._taps[2]) +
        this.readDelayAt(11, this._taps[3]) -
        this.readDelayAt(5, this._taps[4]) -
        this.readDelayAt(6, this._taps[5]) -
        this.readDelayAt(7, this._taps[6]);

      ro =
        this.readDelayAt(5, this._taps[7]) +
        this.readDelayAt(5, this._taps[8]) -
        this.readDelayAt(6, this._taps[9]) +
        this.readDelayAt(7, this._taps[10]) -
        this.readDelayAt(9, this._taps[11]) -
        this.readDelayAt(10, this._taps[12]) -
        this.readDelayAt(11, this._taps[13]);

      outputs[0][0][i] += lo * we;
      outputs[0][1][i] += ro * we;

      this._excPhase += ex;

      i++;

      for (
        let j = 0, d = this._Delays[0];
        j < this._Delays.length;
        d = this._Delays[++j]
      ) {
        d[1] = (d[1] + 1) & d[3];
        d[2] = (d[2] + 1) & d[3];
      }
    }

    // Update preDelay index
    this._pDWrite = (this._pDWrite + 128) % this._pDLength;

    return true;
  }
}

registerProcessor("DattorroReverb", DattorroReverb);
