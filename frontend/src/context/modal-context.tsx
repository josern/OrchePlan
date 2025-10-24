"use client";

import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';

type ModalEntry = {
  id: number;
  node: ReactNode;
};

type ModalContextType = {
  showModal: (node: ReactNode) => number;
  closeModal: (id: number) => void;
  closeAll: () => void;
};

const ModalContext = createContext<ModalContextType | undefined>(undefined);

let nextId = 1;

export function ModalProvider({ children }: { children: ReactNode }) {
  const [modals, setModals] = useState<ModalEntry[]>([]);

  const showModal = useCallback((node: ReactNode) => {
    const id = nextId++;
    setModals(prev => [...prev, { id, node }]);
    return id;
  }, []);

  const closeModal = useCallback((id: number) => {
    setModals(prev => prev.filter(m => m.id !== id));
  }, []);

  const closeAll = useCallback(() => setModals([]), []);

  return (
    <ModalContext.Provider value={{ showModal, closeModal, closeAll }}>
      {children}
      {/*
        Render a stable modal root in the React tree so server and client markup
        match exactly. Using createPortal only on the client can lead to
        hydration mismatches because the server omits the element entirely.
        Rendering the container unconditionally keeps SSR consistent; the
        actual modal children are mounted into this container.
      */}
      <div id="__modal_root" aria-live="polite">
        {modals.map(m => (
          React.isValidElement(m.node)
            ? React.cloneElement(m.node as React.ReactElement, { modalId: m.id, key: m.id })
            : <React.Fragment key={m.id}>{m.node}</React.Fragment>
        ))}
      </div>
    </ModalContext.Provider>
  );
}

export function useModal() {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('useModal must be used within a ModalProvider');
  return ctx;
}

export default ModalProvider;
