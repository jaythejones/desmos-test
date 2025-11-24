"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Image from "next/image";

type LogEntry = {
  id: string;
  timestamp: number;
  type: "raf" | "click" | "click-handler" | "blocking" | "frame";
  message: string;
  details?: string;
  latency?: number;
  severity?: "warning" | "error" | "info";
};

type PerformanceMetrics = {
  clickLatency: number | null;
  avgFrameTime: number;
  rafCallRate: number;
  queuedRAF: number;
  isBlocking: boolean;
  lastClickTime: number | null;
  lastHandlerTime: number | null;
};

export default function Home() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    clickLatency: null,
    avgFrameTime: 0,
    rafCallRate: 0,
    queuedRAF: 0,
    isBlocking: false,
    lastClickTime: null,
    lastHandlerTime: null,
  });
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logCallbackRef = useRef<((entry: LogEntry) => void) | null>(null);
  const clickEventTimeRef = useRef<number | null>(null);
  const rafQueueRef = useRef<number>(0);
  const frameTimesRef = useRef<number[]>([]);
  const rafCallCountRef = useRef<number>(0);
  const lastRAFLogTimeRef = useRef<number>(Date.now());
  const frameStartTimeRef = useRef<number | null>(null);
  const blockingFramesBatchRef = useRef<number[]>([]);
  const blockingFramesCountRef = useRef<number>(0);

  // Scroll to bottom when new logs are added
  // useEffect(() => {
  // logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  // }, [logs]);

  const addLog = useCallback((entry: LogEntry) => {
    setLogs((prev) => [entry, ...prev].slice(0, 100)); // Keep last 100 logs, newest at the top
  }, []);

  // Store the callback so it can be used in the RAF interceptor
  useEffect(() => {
    logCallbackRef.current = addLog;
  }, [addLog]);

  useEffect(() => {
    // Store the original requestAnimationFrame
    const originalRAF = window.requestAnimationFrame;
    const logInterval = 1000; // Log every second

    // Override requestAnimationFrame to track calls and measure frame times
    window.requestAnimationFrame = function (callback: FrameRequestCallback) {
      rafCallCountRef.current++;
      rafQueueRef.current++;
      const now = Date.now();

      // Track when frame starts
      const frameStart = performance.now();

      // Wrap the callback to measure execution time
      const wrappedCallback: FrameRequestCallback = (timestamp: number) => {
        const frameEnd = performance.now();
        const frameTime = frameEnd - frameStart;
        rafQueueRef.current = Math.max(0, rafQueueRef.current - 1);

        // Track frame times (keep last 60 frames)
        frameTimesRef.current.push(frameTime);
        if (frameTimesRef.current.length > 60) {
          frameTimesRef.current.shift();
        }

        // Check for blocking (frame time > 16.67ms means we're dropping frames at 60fps)
        if (frameTime > 16.67 && logCallbackRef.current) {
          blockingFramesBatchRef.current.push(frameTime);
          blockingFramesCountRef.current++;

          // Log batch summary every 60 blocking frames
          if (blockingFramesCountRef.current >= 60) {
            const batch = blockingFramesBatchRef.current;
            const avgBlockingTime =
              batch.reduce((a, b) => a + b, 0) / batch.length;
            const maxBlockingTime = Math.max(...batch);
            const minBlockingTime = Math.min(...batch);
            const errorCount = batch.filter((t) => t > 50).length;
            const warningCount = batch.filter(
              (t) => t > 16.67 && t <= 50
            ).length;

            const severity = errorCount > 30 ? "error" : "warning";

            logCallbackRef.current({
              id: `blocking-batch-${Date.now()}-${Math.random()}`,
              timestamp: Date.now(),
              type: "blocking",
              message: `⚠️ Batch of 60 blocking frames: Avg ${avgBlockingTime.toFixed(
                2
              )}ms, Max ${maxBlockingTime.toFixed(
                2
              )}ms, Min ${minBlockingTime.toFixed(2)}ms`,
              details: `${errorCount} errors (>50ms), ${warningCount} warnings (16.67-50ms). Queue depth: ${rafQueueRef.current}`,
              severity,
              latency: avgBlockingTime,
            });

            // Reset batch
            blockingFramesBatchRef.current = [];
            blockingFramesCountRef.current = 0;
          }
        }

        // Call original callback
        callback(timestamp);
      };

      // Log aggregated stats every second
      if (
        now - lastRAFLogTimeRef.current >= logInterval &&
        logCallbackRef.current
      ) {
        const avgFrameTime =
          frameTimesRef.current.length > 0
            ? frameTimesRef.current.reduce((a, b) => a + b, 0) /
              frameTimesRef.current.length
            : 0;

        // Flush any incomplete blocking frames batch
        if (blockingFramesCountRef.current > 0) {
          const batch = blockingFramesBatchRef.current;
          const avgBlockingTime =
            batch.reduce((a, b) => a + b, 0) / batch.length;
          const maxBlockingTime = Math.max(...batch);
          const minBlockingTime = Math.min(...batch);
          const errorCount = batch.filter((t) => t > 50).length;
          const warningCount = batch.filter((t) => t > 16.67 && t <= 50).length;

          const severity = errorCount > batch.length / 2 ? "error" : "warning";

          logCallbackRef.current({
            id: `blocking-batch-${Date.now()}-${Math.random()}`,
            timestamp: Date.now(),
            type: "blocking",
            message: `⚠️ Batch of ${
              blockingFramesCountRef.current
            } blocking frames: Avg ${avgBlockingTime.toFixed(
              2
            )}ms, Max ${maxBlockingTime.toFixed(
              2
            )}ms, Min ${minBlockingTime.toFixed(2)}ms`,
            details: `${errorCount} errors (>50ms), ${warningCount} warnings (16.67-50ms). Queue depth: ${rafQueueRef.current}`,
            severity,
            latency: avgBlockingTime,
          });

          // Reset batch
          blockingFramesBatchRef.current = [];
          blockingFramesCountRef.current = 0;
        }

        const entry: LogEntry = {
          id: `raf-${Date.now()}-${Math.random()}`,
          timestamp: now,
          type: "raf",
          message: `requestAnimationFrame: ${
            rafCallCountRef.current
          } calls/sec, Avg frame: ${avgFrameTime.toFixed(2)}ms, Queue: ${
            rafQueueRef.current
          }`,
          details: `Frame times: ${frameTimesRef.current
            .slice(-10)
            .map((t) => t.toFixed(1))
            .join(", ")}ms`,
        };
        logCallbackRef.current(entry);

        // Update metrics
        setMetrics((prev) => ({
          ...prev,
          rafCallRate: rafCallCountRef.current,
          avgFrameTime,
          queuedRAF: rafQueueRef.current,
          isBlocking: avgFrameTime > 16.67 || rafQueueRef.current > 5,
        }));

        rafCallCountRef.current = 0;
        lastRAFLogTimeRef.current = now;
      }

      // Call the original requestAnimationFrame
      return originalRAF.call(window, wrappedCallback);
    };

    addLog({
      id: `init-${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      type: "raf",
      message: "Monitoring requestAnimationFrame calls from calculator.js",
    });

    // Cleanup on unmount
    return () => {
      window.requestAnimationFrame = originalRAF;
    };
  }, [addLog]);

  // Track click events
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.id === "test-button") {
        const clickTime = performance.now();
        clickEventTimeRef.current = clickTime;

        addLog({
          id: `click-${Date.now()}-${Math.random()}`,
          timestamp: Date.now(),
          type: "click",
          message: "Test button clicked (event captured)",
          details: `Target: ${target.tagName}, X: ${e.clientX}, Y: ${e.clientY}`,
        });

        setMetrics((prev) => ({
          ...prev,
          lastClickTime: clickTime,
        }));
      }
    };

    // Use capture phase to catch the event early
    document.addEventListener("click", handleClick, true);

    return () => {
      document.removeEventListener("click", handleClick, true);
    };
  }, [addLog]);

  // Handle test button click
  const handleTestButtonClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      // This is when the handler actually executes
      const handlerTime = performance.now();
      const latency = clickEventTimeRef.current
        ? handlerTime - clickEventTimeRef.current
        : null;

      const severity =
        latency && latency > 16.67
          ? latency > 100
            ? "error"
            : "warning"
          : "info";

      addLog({
        id: `handler-${Date.now()}-${Math.random()}`,
        timestamp: Date.now(),
        type: "click-handler",
        message: latency
          ? `Click handler executed (${latency.toFixed(2)}ms latency)`
          : "Click handler executed",
        details:
          latency && latency > 16.67
            ? `⚠️ High latency! Event phase: ${e.eventPhase}, RAF queue: ${
                rafQueueRef.current
              }, Avg frame: ${
                frameTimesRef.current.length > 0
                  ? (
                      frameTimesRef.current.reduce((a, b) => a + b, 0) /
                      frameTimesRef.current.length
                    ).toFixed(2)
                  : 0
              }ms`
            : `Event phase: ${e.eventPhase}, Current target: ${
                (e.currentTarget as HTMLElement).tagName
              }`,
        latency: latency || undefined,
        severity,
      });

      setMetrics((prev) => ({
        ...prev,
        clickLatency: latency,
        lastHandlerTime: handlerTime,
      }));

      clickEventTimeRef.current = null;
    },
    [addLog]
  );

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3,
    });
  };

  const getTypeColor = (
    type: LogEntry["type"],
    severity?: LogEntry["severity"]
  ) => {
    if (severity === "error") return "text-red-400";
    if (severity === "warning") return "text-orange-400";

    switch (type) {
      case "raf":
        return "text-blue-400";
      case "click":
        return "text-yellow-400";
      case "click-handler":
        return "text-green-400";
      case "blocking":
        return "text-red-400";
      case "frame":
        return "text-cyan-400";
      default:
        return "text-gray-400";
    }
  };

  const getTypeLabel = (type: LogEntry["type"]) => {
    switch (type) {
      case "raf":
        return "RAF";
      case "click":
        return "CLICK";
      case "click-handler":
        return "HANDLER";
      case "blocking":
        return "BLOCK";
      case "frame":
        return "FRAME";
      default:
        return "LOG";
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-6xl flex-col py-8 px-8 bg-white dark:bg-black">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-4">
            Event Tracker - Performance Analysis
          </h1>

          {/* Performance Metrics Dashboard */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div
              className={`p-4 rounded-lg border-2 ${
                metrics.isBlocking
                  ? "border-red-500 bg-red-50 dark:bg-red-950"
                  : "border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900"
              }`}
            >
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                Click Latency
              </div>
              <div
                className={`text-2xl font-bold ${
                  metrics.clickLatency && metrics.clickLatency > 16.67
                    ? "text-red-600 dark:text-red-400"
                    : "text-gray-900 dark:text-gray-100"
                }`}
              >
                {metrics.clickLatency !== null
                  ? `${metrics.clickLatency.toFixed(1)}ms`
                  : "—"}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {metrics.clickLatency && metrics.clickLatency > 16.67
                  ? "⚠️ Blocked"
                  : "✓ Normal"}
              </div>
            </div>

            <div
              className={`p-4 rounded-lg border-2 ${
                metrics.avgFrameTime > 16.67
                  ? "border-orange-500 bg-orange-50 dark:bg-orange-950"
                  : "border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900"
              }`}
            >
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                Avg Frame Time
              </div>
              <div
                className={`text-2xl font-bold ${
                  metrics.avgFrameTime > 16.67
                    ? "text-orange-600 dark:text-orange-400"
                    : "text-gray-900 dark:text-gray-100"
                }`}
              >
                {metrics.avgFrameTime.toFixed(1)}ms
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Target: 16.67ms (60fps)
              </div>
            </div>

            <div className="p-4 rounded-lg border-2 border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                RAF Call Rate
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {metrics.rafCallRate}/s
              </div>
              <div className="text-xs text-gray-500 mt-1">Calls per second</div>
            </div>

            <div
              className={`p-4 rounded-lg border-2 ${
                metrics.queuedRAF > 5
                  ? "border-yellow-500 bg-yellow-50 dark:bg-yellow-950"
                  : "border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900"
              }`}
            >
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                RAF Queue Depth
              </div>
              <div
                className={`text-2xl font-bold ${
                  metrics.queuedRAF > 5
                    ? "text-yellow-600 dark:text-yellow-400"
                    : "text-gray-900 dark:text-gray-100"
                }`}
              >
                {metrics.queuedRAF}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {metrics.queuedRAF > 5 ? "⚠️ Backlog" : "✓ Normal"}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-4 mb-4">
            <button
              id="test-button"
              onClick={handleTestButtonClick}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
            >
              Test Button (Click to measure latency)
            </button>

            {/* Theory Indicator */}
            {metrics.isBlocking &&
              metrics.clickLatency &&
              metrics.clickLatency > 16.67 && (
                <div className="p-4 bg-red-100 dark:bg-red-950 border-2 border-red-500 rounded-lg">
                  <div className="font-bold text-red-800 dark:text-red-200 mb-2">
                    🚨 Event Handling is maybe Being Blocked
                  </div>
                  <div className="text-sm text-red-700 dark:text-red-300">
                    High click latency ({metrics.clickLatency.toFixed(1)}ms)
                    correlates with:
                    {metrics.avgFrameTime > 16.67 &&
                      ` Slow frames (${metrics.avgFrameTime.toFixed(1)}ms avg)`}
                    {metrics.queuedRAF > 5 &&
                      ` RAF backlog (${metrics.queuedRAF} queued)`}
                    {metrics.rafCallRate > 60 &&
                      ` High RAF rate (${metrics.rafCallRate}/s)`}
                  </div>
                </div>
              )}
          </div>
        </div>

        <div className="flex-1 border border-gray-300 dark:border-gray-700 rounded-lg bg-black text-green-400 font-mono text-sm overflow-hidden">
          <div className="p-4 h-[600px] overflow-y-auto">
            {logs.length === 0 ? (
              <div className="text-gray-500">Waiting for events...</div>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className={`mb-2 ${
                    log.severity === "error"
                      ? "bg-red-950/30"
                      : log.severity === "warning"
                      ? "bg-orange-950/30"
                      : ""
                  }`}
                >
                  <span className="text-gray-500">
                    [{formatTime(log.timestamp)}]
                  </span>{" "}
                  <span
                    className={`font-bold ${getTypeColor(
                      log.type,
                      log.severity
                    )}`}
                  >
                    [{getTypeLabel(log.type)}]
                  </span>{" "}
                  <span className="text-gray-300">{log.message}</span>
                  {log.latency !== undefined && (
                    <span
                      className={`ml-2 ${
                        log.latency > 16.67
                          ? "text-red-400 font-bold"
                          : "text-gray-400"
                      }`}
                    >
                      ({log.latency.toFixed(2)}ms)
                    </span>
                  )}
                  {log.details && (
                    <div className="ml-8 text-gray-400 text-xs mt-1">
                      {log.details}
                    </div>
                  )}
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      </main>
    </div>
  );
}
