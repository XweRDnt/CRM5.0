"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    __domMutationGuardInstalled?: boolean;
  }
}

/**
 * Protects React tree from browser extensions that mutate DOM and trigger
 * NotFoundError during React reconciliation (removeChild/insertBefore).
 */
export function DomMutationGuard(): null {
  useEffect(() => {
    if (typeof window === "undefined" || window.__domMutationGuardInstalled) {
      return;
    }

    window.__domMutationGuardInstalled = true;

    const originalRemoveChild = Node.prototype.removeChild;
    const originalInsertBefore = Node.prototype.insertBefore;

    Node.prototype.removeChild = function patchedRemoveChild<T extends Node>(child: T): T {
      try {
        return originalRemoveChild.call(this, child) as T;
      } catch (error) {
        if (error instanceof DOMException && error.name === "NotFoundError") {
          return child;
        }
        throw error;
      }
    };

    Node.prototype.insertBefore = function patchedInsertBefore<T extends Node>(
      newNode: T,
      referenceNode: Node | null,
    ): T {
      try {
        return originalInsertBefore.call(this, newNode, referenceNode) as T;
      } catch (error) {
        if (error instanceof DOMException && error.name === "NotFoundError") {
          return this.appendChild(newNode) as T;
        }
        throw error;
      }
    };
  }, []);

  return null;
}
