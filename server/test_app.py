from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

from server.app import MODEL_RELATIVE_PATH, create_app


class DeploymentAppTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.dist = Path(self.temporary_directory.name)
        (self.dist / "index.html").write_text("<h1>AutoLaunch</h1>", encoding="utf-8")
        model = self.dist / MODEL_RELATIVE_PATH
        model.parent.mkdir(parents=True)
        model.write_bytes(b"glTF-test")
        self.client = TestClient(create_app(self.dist))

    def tearDown(self) -> None:
        self.temporary_directory.cleanup()

    def test_health_reports_pack_and_model(self) -> None:
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["pack"], "su7-ultra-concept")
        self.assertEqual(response.json()["modelBytes"], 9)

    def test_serves_frontend_index(self) -> None:
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("AutoLaunch", response.text)

    def test_serves_model_with_cache_header(self) -> None:
        response = self.client.get(f"/{MODEL_RELATIVE_PATH.as_posix()}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b"glTF-test")
        self.assertEqual(response.headers["cache-control"], "public, max-age=86400")

        head = self.client.head(f"/{MODEL_RELATIVE_PATH.as_posix()}")
        self.assertEqual(head.status_code, 200)
        self.assertEqual(head.content, b"")
        self.assertEqual(head.headers["content-length"], "9")

    def test_missing_build_fails_fast(self) -> None:
        with tempfile.TemporaryDirectory() as empty:
            with self.assertRaisesRegex(RuntimeError, "npm run build"):
                create_app(empty)


if __name__ == "__main__":
    unittest.main()
