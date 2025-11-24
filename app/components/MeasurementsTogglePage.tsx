"use client";

import { useState } from "react";
import Measurements from "./Measurements";

export default function Page({ title }: { title: string }) {
  const [showMeasurements, setShowMeasurements] = useState(false);

  return (
    <div className="p-8">
      <div className="mb-4">
        <h1 className="text-2xl font-bold mb-4">{title}</h1>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={showMeasurements}
            onChange={(e) => setShowMeasurements(e.target.checked)}
            className="w-5 h-5 cursor-pointer"
          />
          <span className="text-lg">Mount/Unmount Measurements Component</span>
        </label>
      </div>
      {showMeasurements && <Measurements />}
      <p>This page demonstrates the effects of desmos calculator events.</p>
      <p>
        Right now, the <code>layout</code> wrapping this page dictates what
        script (if any) is loaded. Open the browser Timelines or Performance
        developer tool to see any events fired when the page is idle. As a
        baseline, it should be minimal/none.
      </p>
      <p>
        Mount the Measurements component to see an interactive log of events and
        test some click events.
      </p>
    </div>
  );
}
