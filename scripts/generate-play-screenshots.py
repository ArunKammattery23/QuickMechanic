from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "play-store-assets" / "screenshots"
OUT.mkdir(parents=True, exist_ok=True)

BLACK = "#080A09"
CARD = "#151917"
LIME = "#B9F227"
WHITE = "#F6F8F7"
MUTED = "#AAB2AD"


def font(size: int, bold: bool = False):
    names = ["arialbd.ttf" if bold else "arial.ttf", "segoeuib.ttf" if bold else "segoeui.ttf"]
    for name in names:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            pass
    return ImageFont.load_default()


def screenshot(path: Path, role: str, headline: str, subhead: str, rows: list[tuple[str, str]], badge: str):
    im = Image.new("RGB", (1080, 1920), BLACK)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((70, 70, 1010, 1850), radius=68, fill="#0E1210", outline="#2A302C", width=4)
    d.ellipse((120, 132, 210, 222), fill=LIME)
    d.text((149, 141), "Q", font=font(51, True), fill=BLACK)
    d.text((235, 143), "QuickMechanic", font=font(47, True), fill=WHITE)
    d.rounded_rectangle((770, 137, 945, 207), radius=35, fill="#263029")
    d.text((805, 154), role, font=font(27, True), fill=LIME)
    d.text((120, 320), headline, font=font(72, True), fill=WHITE)
    d.text((120, 420), subhead, font=font(36), fill=MUTED)
    y = 560
    for title, detail in rows:
        d.rounded_rectangle((120, y, 960, y + 250), radius=38, fill=CARD, outline="#29312C", width=3)
        d.ellipse((165, y + 66, 245, y + 146), fill="#253327")
        d.text((191, y + 74), "✓", font=font(43, True), fill=LIME)
        d.text((280, y + 55), title, font=font(40, True), fill=WHITE)
        d.text((280, y + 120), detail, font=font(30), fill=MUTED)
        y += 285
    d.rounded_rectangle((120, 1615, 960, 1735), radius=60, fill=LIME)
    w = d.textbbox((0, 0), badge, font=font(40, True))[2]
    d.text(((1080 - w) / 2, 1652), badge, font=font(40, True), fill=BLACK)
    im.save(path, optimize=True)


sets = {
    "customer": [
        ("Help is closer than you think", "Request roadside assistance", [("Set your location", "Pin the breakdown point"), ("Choose a service", "Tell mechanics what you need"), ("Track your mechanic", "Follow arrival and job status")], "REQUEST HELP"),
        ("Stay informed at every step", "From quote to completion", [("Review quotes", "See service and price details"), ("Message securely", "Contact your assigned mechanic"), ("Service history", "Keep past jobs in one place")], "GET BACK ON THE ROAD"),
    ],
    "provider": [
        ("Grow your service business", "Manage nearby job requests", [("Receive requests", "See customer and vehicle needs"), ("Send clear quotes", "Share price and service details"), ("Navigate to customers", "Use the confirmed breakdown point")], "START HELPING"),
        ("Work with confidence", "Stay organized throughout the day", [("Update job status", "Keep customers informed"), ("Chat in the app", "Coordinate without confusion"), ("Track earnings", "Review completed work")], "MANAGE YOUR JOBS"),
    ],
    "admin": [
        ("Run operations clearly", "Monitor the QuickMechanic network", [("View active jobs", "Track service progress"), ("Manage users", "Support customers and providers"), ("Review activity", "See important platform events")], "OPEN DASHBOARD"),
        ("Keep service quality high", "Tools for daily administration", [("Handle support", "Review reported issues"), ("Manage services", "Keep offerings up to date"), ("Use live insights", "Make informed decisions")], "STAY IN CONTROL"),
    ],
}

for role, pages in sets.items():
    for i, page in enumerate(pages, 1):
        screenshot(OUT / f"quickmechanic-{role}-{i}.png", role.title(), *page)

print(f"Created {len(sets) * 2} screenshots in {OUT}")
