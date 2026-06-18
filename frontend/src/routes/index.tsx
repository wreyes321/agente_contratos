// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Routes, Route } from "react-router-dom"
import ChatPage from "./ChatPage"
import DocumentsPage from "./DocumentsPage"
import { AppLayout } from "@/components/layout/AppLayout"

export default function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <AppLayout>
            <ChatPage />
          </AppLayout>
        }
      />
      <Route
        path="/documents"
        element={
          <AppLayout>
            <DocumentsPage />
          </AppLayout>
        }
      />
    </Routes>
  )
}
