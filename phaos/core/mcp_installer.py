"""MCP installer — install/uninstall MCP server packages via npm or pip."""

from __future__ import annotations

import logging
import shlex
import subprocess
import sys
from typing import Tuple

logger = logging.getLogger(__name__)


def _check_command(cmd: str) -> bool:
    try:
        subprocess.run(
            [cmd, "--version"],
            capture_output=True,
            timeout=10,
            shell=(sys.platform == "win32"),
        )
        return True
    except Exception:
        return False


class MCPInstaller:
    """Install/uninstall MCP server packages via npm/pip."""

    def __init__(self):
        self.npm_available = _check_command("npm")
        self.pip_available = _check_command("pip")

    def install_npm(self, package: str) -> Tuple[bool, str]:
        if not self.npm_available:
            return False, "npm is not available on this system"
        try:
            cmd = ["npm", "install", "-g", package]
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=120,
                shell=(sys.platform == "win32"),
            )
            if result.returncode == 0:
                return True, f"Installed {package} successfully"
            return False, result.stderr or result.stdout
        except subprocess.TimeoutExpired:
            return False, f"Installation of {package} timed out after 120s"
        except Exception as e:
            logger.error("npm install failed: %s", e)
            return False, str(e)

    def install_pip(self, package: str) -> Tuple[bool, str]:
        if not self.pip_available:
            return False, "pip is not available on this system"
        try:
            cmd = [sys.executable, "-m", "pip", "install", package]
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=120,
                shell=False,
            )
            if result.returncode == 0:
                return True, f"Installed {package} successfully"
            return False, result.stderr or result.stdout
        except subprocess.TimeoutExpired:
            return False, f"Installation of {package} timed out after 120s"
        except Exception as e:
            logger.error("pip install failed: %s", e)
            return False, str(e)

    def uninstall_npm(self, package: str) -> Tuple[bool, str]:
        if not self.npm_available:
            return False, "npm is not available on this system"
        try:
            result = subprocess.run(
                ["npm", "uninstall", "-g", package],
                capture_output=True,
                text=True,
                timeout=60,
                shell=(sys.platform == "win32"),
            )
            if result.returncode == 0:
                return True, f"Uninstalled {package} successfully"
            return False, result.stderr or result.stdout
        except Exception as e:
            return False, str(e)

    def uninstall_pip(self, package: str) -> Tuple[bool, str]:
        if not self.pip_available:
            return False, "pip is not available on this system"
        try:
            result = subprocess.run(
                [sys.executable, "-m", "pip", "uninstall", "-y", package],
                capture_output=True,
                text=True,
                timeout=60,
                shell=False,
            )
            if result.returncode == 0:
                return True, f"Uninstalled {package} successfully"
            return False, result.stderr or result.stdout
        except Exception as e:
            return False, str(e)

    def is_installed_npm(self, package: str) -> bool:
        try:
            result = subprocess.run(
                ["npm", "ls", "-g", package],
                capture_output=True,
                text=True,
                timeout=10,
                shell=(sys.platform == "win32"),
            )
            return result.returncode == 0
        except Exception:
            return False

    def is_installed_pip(self, package: str) -> bool:
        try:
            result = subprocess.run(
                [sys.executable, "-m", "pip", "show", package],
                capture_output=True,
                text=True,
                timeout=10,
                shell=False,
            )
            return result.returncode == 0
        except Exception:
            return False
