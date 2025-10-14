"use client";

import React from 'react';

export default function ContentLoading() {
  return (
    <div 
      className="fixed inset-0 flex items-center justify-center"
      style={{ 
        backgroundColor: '#f3f4f0',
        left: '256px'
      }}
    >
      <div 
        className="animate-spin rounded-full h-6 w-6 border-b-2"
        style={{ borderColor: '#80807f' }}
      ></div>
    </div>
  );
}