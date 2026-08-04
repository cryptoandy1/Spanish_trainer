import { RouterProvider } from "react-router-dom";
import { DataProvider } from "./lib/DataContext";
import { router } from "./routes";

export default function App() {
  return (
    <DataProvider>
      <RouterProvider router={router} />
    </DataProvider>
  );
}
