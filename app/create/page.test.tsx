"use client";

import React from "react";
import { ToastContainer } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';

export default function CreatePage() {
  return (
    <div className="flex flex-col min-h-screen">
      <ToastContainer position="top-right" autoClose={5000} />
      <div className="p-4 xl:p-6">
        <div className="pt-8 xl:pt-8">
          <h1>Test Page</h1>
        </div>
      </div>
    </div>
  );
}