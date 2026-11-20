import React from 'react';
import { useSlideViewModel } from '../view-model/context.jsx';

export const FIXED_HUAWEI_BACK_COVER_LAYOUT = 'theme17_back_cover';

export function FixedHuaweiBackCover() {
  const viewModel = useSlideViewModel();
  return (
    <section
      className="slide fixed-huawei-back-cover"
      data-layout="HUAWEI-BACK-COVER"
      data-vm-slide-id={viewModel?.id}
      data-vm-slide-key={viewModel?.key}
      data-vm-layout={viewModel?.layout}
      data-vm-index={viewModel?.index}
      data-theme-pack="theme17"
      data-label="Huawei fixed back cover"
      data-editor-locked="true"
      data-content-locked="true"
      data-fixed-back-cover="true"
      data-prop-controls="[]"
      data-prop-defaults="{}"
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: '#FFFFFF',
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      <img
        src="assets/huawei-back-cover.png"
        alt=""
        aria-hidden="true"
        draggable="false"
        width="1280"
        height="720"
        style={{
          position: 'absolute',
          inset: 0,
          display: 'block',
          width: '100%',
          height: '100%',
          maxWidth: 'none',
          objectFit: 'fill',
          pointerEvents: 'none',
        }}
      />
    </section>
  );
}
