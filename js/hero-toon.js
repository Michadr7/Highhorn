/* Accepted Commoner toon materials, shared by detailed previews and board LODs. */
'use strict';
window.HighhornToon = (() => {
  const garments = new Set(['Tunic','Pants','Boots','Shoulders']);
  function apply(root, {legacyBoard=false} = {}) {
    root.traverse(mesh => {
      if (!mesh.isMesh || (!garments.has(mesh.name) && !['char1','Female_Body'].includes(mesh.name))) return;
      const skin = ['char1','Female_Body'].includes(mesh.name);
      const convert = source => {
        if(source.userData.highhornToon)return source;
        const material = new THREE.MeshToonMaterial({
          name:'Highhorn v5 '+mesh.name, color:source.color.clone(), map:source.map,
          skinning:!!mesh.isSkinnedMesh, side:source.side,
          transparent:source.transparent, opacity:source.opacity, alphaTest:source.alphaTest
        });
        material.flatShading = false;
        material.morphTargets = !!mesh.morphTargetInfluences;
        material.morphNormals = false;
        material.userData.highhornFacetNormals = !skin;
        material.userData.highhornToon = true;
        material.userData.highhornSoftSkin = skin;
        material.onBeforeCompile = (shader, renderer) => {
          shader.fragmentShader = shader.fragmentShader.replace('#include <gradientmap_pars_fragment>',
            'vec3 getGradientIrradiance(vec3 n, vec3 l) { return vec3(max(dot(n,l),0.0)); }');
          const original='vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;';
          if (!shader.fragmentShader.includes(original)) throw Error('Unsupported Three.js toon shader version');
          const bands = skin
            ? 'float band = 0.56 + 0.30*smoothstep(0.41,0.69,level) + 0.30*smoothstep(0.81,1.09,level);'
            : 'float band = level < 0.42 ? 0.20 : (level < 0.85 ? 0.50 : (level < 1.25 ? 0.92 : 1.38));';
          shader.fragmentShader = shader.fragmentShader.replace(original, `
            vec3 illumination = (reflectedLight.directDiffuse + reflectedLight.indirectDiffuse) / max(diffuseColor.rgb,vec3(0.0001));
            float level = dot(illumination,vec3(0.2126,0.7152,0.0722));
            ${bands}
            vec3 outgoingLight = diffuseColor.rgb * band + totalEmissiveRadiance;
          `);
          if(legacyBoard && renderer.outputEncoding===THREE.LinearEncoding)shader.fragmentShader=shader.fragmentShader.replace('#include <encodings_fragment>','gl_FragColor = LinearTosRGB( gl_FragColor );');
        };
        material.customProgramCacheKey = () => (skin ? 'highhorn-soft-skin-v5' : 'highhorn-hard-cloth-v5') + (legacyBoard?'-board':'-hero');
        return material;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(convert) : convert(mesh.material);
    });
  }
  return {apply,clothBands:[.20,.50,.92,1.38],skinBands:[.56,.86,1.16]};
})();
