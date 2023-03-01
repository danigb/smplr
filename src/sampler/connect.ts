export type AudioInsert = {
  input: AudioNode;
  output: AudioNode;
};

export function connectSerial(nodes: (AudioNode | AudioInsert | undefined)[]) {
  const _nodes = nodes.filter((x): x is AudioNode | AudioInsert => !!x);
  _nodes.reduce((a, b) => {
    const left = "output" in a ? a.output : a;
    const right = "input" in b ? b.input : b;
    left.connect(right);
    return b;
  });

  return () => {
    _nodes.reduce((a, b) => {
      const left = "output" in a ? a.output : a;
      const right = "input" in b ? b.input : b;
      left.disconnect(right);
      return b;
    });
  };
}

export function connectAudioBus(
  node: AudioNode,
  destination: AudioNode,
  gain: number
) {
  const mix = node.context.createGain();
  mix.gain.value = gain;
  node.connect(mix);
  mix.connect(destination);

  return () => {
    node.disconnect(mix);
    mix.disconnect(destination);
  };
}
