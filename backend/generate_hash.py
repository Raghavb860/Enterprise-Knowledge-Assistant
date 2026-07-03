# generate_hash.py

from passlib.context import CryptContext

pwd = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=12
)

print(pwd.hash("Admin@123"))