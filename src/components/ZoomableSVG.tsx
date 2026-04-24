import { useState, useRef } from "react";
import { Maximize2, X, ZoomIn, ZoomOut, RotateCcw, Download } from "lucide-react";
import { Button } from "./ui/button";
import { motion, AnimatePresence } from "motion/react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

interface ZoomableSVGProps {
  svgCode: string;
}

export const ZoomableSVG = ({ svgCode }: ZoomableSVGProps) => {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const fullScreenRef = useRef<HTMLDivElement>(null);

  const downloadSVG = () => {
    const svgBlob = new Blob([svgCode], { type: "image/svg+xml;charset=utf-8" });
    const svgUrl = URL.createObjectURL(svgBlob);
    const downloadLink = document.createElement("a");
    downloadLink.href = svgUrl;
    downloadLink.download = `schema-${Date.now()}.svg`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  return (
    <>
      <div className="group relative flex flex-col items-center my-4 p-4 bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8 bg-white/80 backdrop-blur-sm border-slate-200 shadow-sm"
            onClick={() => setIsFullScreen(true)}
            title="Plein écran"
          >
            <Maximize2 className="w-4 h-4 text-slate-600" />
          </Button>
        </div>
        <div 
          className="w-full overflow-x-auto flex justify-center"
          dangerouslySetInnerHTML={{ __html: svgCode }}
        />
      </div>

      <AnimatePresence>
        {isFullScreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-white/95 backdrop-blur-md flex items-center justify-center p-4 md:p-10"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white w-full h-full rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between p-4 border-b border-slate-100">
                <div className="flex flex-col">
                  <h3 className="text-sm font-semibold text-slate-900">Vue détaillée du schéma</h3>
                  <p className="text-[10px] text-slate-500">Utilisez la souris ou les doigts pour zoomer et déplacer</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-2 text-xs border-emerald-100 text-emerald-700 hover:bg-emerald-50"
                    onClick={downloadSVG}
                  >
                    <Download className="w-3.5 h-3.5" />
                    Télécharger SVG
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 rounded-full hover:bg-slate-100"
                    onClick={() => setIsFullScreen(false)}
                  >
                    <X className="w-5 h-5 text-slate-500" />
                  </Button>
                </div>
              </div>
              
              <div className="flex-1 relative bg-slate-50/50 overflow-hidden">
                <TransformWrapper
                  initialScale={1}
                  initialPositionX={0}
                  initialPositionY={0}
                  centerOnInit={true}
                >
                  {({ zoomIn, zoomOut, resetTransform }) => (
                    <>
                      <div className="absolute bottom-6 right-6 z-20 flex flex-col gap-2">
                        <Button
                          size="icon"
                          variant="secondary"
                          className="h-10 w-10 rounded-xl shadow-lg bg-white border border-slate-200"
                          onClick={() => zoomIn()}
                          title="Zoom avant"
                        >
                          <ZoomIn className="w-5 h-5 text-slate-600" />
                        </Button>
                        <Button
                          size="icon"
                          variant="secondary"
                          className="h-10 w-10 rounded-xl shadow-lg bg-white border border-slate-200"
                          onClick={() => zoomOut()}
                          title="Zoom arrière"
                        >
                          <ZoomOut className="w-5 h-5 text-slate-600" />
                        </Button>
                        <Button
                          size="icon"
                          variant="secondary"
                          className="h-10 w-10 rounded-xl shadow-lg bg-white border border-slate-200"
                          onClick={() => resetTransform()}
                          title="Réinitialiser"
                        >
                          <RotateCcw className="w-5 h-5 text-slate-600" />
                        </Button>
                      </div>
                      
                      <TransformComponent
                        wrapperStyle={{
                          width: "100%",
                          height: "100%",
                        }}
                        contentStyle={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <div 
                          ref={fullScreenRef} 
                          className="p-10"
                          dangerouslySetInnerHTML={{ __html: svgCode }}
                        />
                      </TransformComponent>
                    </>
                  )}
                </TransformWrapper>
              </div>
              
              <div className="p-3 bg-white border-t border-slate-100 flex justify-center">
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Mode Exploration Interactive</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
