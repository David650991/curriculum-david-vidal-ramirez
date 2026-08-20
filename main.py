"""Punto de entrada del generador del portafolio."""

from portfolio import Portfolio

__all__ = ["Portfolio"]


if __name__ == "__main__":
    destination = Portfolio().build()
    print(f"Portafolio generado en {destination}")
