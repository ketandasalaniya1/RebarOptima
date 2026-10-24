import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    cssMinify: false
  },
  define: {
    __VUE_OPTIONS_API__: true,
    __VUE_PROD_DEVTOOLS__: false,
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false
  },
  resolve: {
    alias: {
      'three/examples/jsm/libs/stats.module': 'three/examples/jsm/libs/stats.module.js',
      'three/examples/jsm/controls/OrbitControls': 'three/examples/jsm/controls/OrbitControls.js'
    }
  },
  optimizeDeps: {
    include: [
      'three',
      'three/examples/jsm/lines/LineSegments2.js',
      'three/examples/jsm/lines/Line2.js',
      'three/examples/jsm/lines/LineMaterial.js',
      'three/examples/jsm/lines/LineGeometry.js',
      'three/examples/jsm/lines/LineSegmentsGeometry.js',
      '@mlightcad/cad-viewer',
      '@mlightcad/cad-simple-viewer',
      '@mlightcad/cad-html-plugin',
      '@mlightcad/data-model',
      '@mlightcad/libredwg-converter',
      'pdfjs-dist'
    ]
  }
})
