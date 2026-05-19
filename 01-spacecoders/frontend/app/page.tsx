"use client";

import { useEffect, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';

export default function SinglePlayerGame() {
  const canvasRef = useRef(null);
  const [userCode, setUserCode] = useState("// Type your command here\nmoveForward();");

  const spaceship = useRef({
    x: 250,
    y: 250,
    angle: 0,
    speed: 0
  });

  useEffect(() => {
    const canvas: any = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationFrameId = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const ship = spaceship.current;
      const radians = (ship.angle * Math.PI) / 180;
      ship.x += Math.cos(radians) * ship.speed;
      ship.y += Math.sin(radians) * ship.speed;

      ctx.save();
      ctx.translate(ship.x, ship.y);
      ctx.rotate(radians);

      // Drawing the Spaceship
      ctx.fillStyle = "#38bdf8";
      ctx.beginPath();
      ctx.moveTo(15, 0);
      ctx.lineTo(-10, -10);
      ctx.lineTo(-10, 10);
      ctx.closePath();
      ctx.fill();

      ctx.restore();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  // Function to execute the user's code safely
  const runCode = () => {

    try {
      const moveForward = (distance = 50) => {
        const ship = spaceship.current;
        const radians = (ship.angle * Math.PI) / 180;

        ship.x += Math.cos(radians) * distance;
        ship.y += Math.sin(radians) * distance;
      };

      const turnRight = (degrees = 90) => {
        spaceship.current.angle += degrees;
      };

      const turnLeft = (degrees = 90) => {
        spaceship.current.angle -= degrees;
      };

      const compiledUserCode = new Function(
        'moveForward',
        'turnRight',
        'turnLeft',
        userCode
      );

      compiledUserCode(moveForward, turnRight, turnLeft);


    } catch (error: any) {
      alert(`Error in your code: ${error.message}`);
    }
  };

  return (
    <div className="flex gap-5 p-5 bg-slate-950 text-white h-screen">

      {/* Left Side: Code Editor */}
      <div className="flex-1 flex flex-col gap-3">
        <h2 className="text-xl font-bold">Code Terminal</h2>

        <div className="flex-1 rounded-lg overflow-hidden border-2 border-slate-700">
          <Editor
            height="100%"
            defaultLanguage="javascript"
            theme="vs-dark"
            value={userCode}
            onChange={(value) => setUserCode(value || "")}

            // 1. The onMount hook gives us direct access to the underlying Monaco engine instance
            onMount={(editor, monaco) => {
              // Drop the standard browser DOM library (window, document, fetch, etc.)
              // By strictly providing only ['es6'], we strip out the browser environment entirely
              monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
                target: monaco.languages.typescript.ScriptTarget.ES2015,
                lib: ['es6'], // 👈 No 'dom' library! Wipes out browser clutter safely.
              });

              // Inject ONLY our game's custom allowed function signatures
              monaco.languages.typescript.javascriptDefaults.addExtraLib(`
      declare function moveForward(distance?: number): void;
      declare function turnRight(degrees?: number): void;
      declare function turnLeft(degrees?: number): void;
    `, 'spacecraft-api.d.ts');
            }}

            options={{
              minimap: { enabled: false },
              fontSize: 16,
              wordWrap: "on",
              // 2. Stop Monaco from predicting random plain text words you typed earlier
              wordBasedSuggestions: "off",
            }}
          />
        </div>

        {/* Execute Button */}
        <button
          onClick={runCode}
          className="p-3 bg-emerald-500 hover:bg-emerald-600 transition-colors text-white border-none rounded-lg cursor-pointer text-base font-bold"
        >
          Execute Code
        </button>
      </div>

      {/* Right Side: Game Arena */}
      <div className="flex-1 flex flex-col items-center gap-3">
        <h2 className="text-xl font-bold">Space Arena</h2>
        <canvas
          ref={canvasRef}
          width={500}
          height={500}
          className="border-2 border-slate-700 rounded-lg bg-slate-900 shadow-lg"
        />
      </div>
    </div>
  );
}