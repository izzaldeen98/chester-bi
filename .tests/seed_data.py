import os
import random
from datetime import datetime, timedelta
from faker import Faker
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Numeric, ForeignKey
from sqlalchemy.orm import sessionmaker, declarative_base, relationship

# 1. Database Connection Configuration
# Links directly to your local running Docker Postgres Container port mapping
DATABASE_URL = "postgresql://dev_admin:SecretPassword123@localhost:5432/bi_testing_db"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
fake = Faker()

# 2. Define the Relational DB Schemas
class Store(Base):
    __tablename__ = "stores"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    region = Column(String, nullable=False) # e.g., North, South, Europe
    manager = Column(String, nullable=False)

    # Relationship links
    orders = relationship("Order", back_populates="store")


class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String, unique=True, nullable=False)
    customer_email = Column(String, nullable=False)
    status = Column(String, default="completed", nullable=False) # completed, refunded, pending
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    created_at = Column(DateTime, nullable=False)

    # Relationship links
    store = relationship("Store", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    product_name = Column(String, nullable=False)
    category = Column(String, nullable=False) # e.g., Electronics, Apparel
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Numeric(10, 2), nullable=False)

    # Relationship links
    order = relationship("Order", back_populates="items")


# 3. Clean and Rebuild Tables
print("🚀 Dropping old structures and building fresh Postgres tables...")
Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)

# 4. Generate Mock Datasets
with SessionLocal() as db:
    print("🌱 Injecting mock physical stores...")
    store_locations = [
        {"name": "Downtown flagship", "region": "North", "manager": fake.name()},
        {"name": "Metro Mall Outlet", "region": "South", "manager": fake.name()},
        {"name": "West End Branch", "region": "West", "manager": fake.name()},
        {"name": "Euro Hub Logistics", "region": "Europe", "manager": fake.name()}
    ]
    db_stores = [Store(**s) for s in store_locations]
    db.add_all(db_stores)
    db.flush() # Flushes arrays to obtain parent IDs in memory

    print("🌱 Generating order metrics matrix datasets...")
    product_catalog = {
        "Electronics": [("Laptop Pro 15", 1200.00), ("Wireless Headphones", 150.00), ("4K Monitor", 350.00)],
        "Apparel": [("Leather Jacket", 250.00), ("Running Shoes", 120.00), ("Slim Fit Jeans", 80.00)],
        "Home Goods": [("Ergonomic Chair", 299.00), ("Desk Lamp", 45.00), ("Coffee Maker", 89.00)]
    }

    # Generate 500 total orders over a rolling historical timeline (past 60 days)
    for i in range(1, 501):
        random_days_ago = random.randint(0, 60)
        order_date = datetime.utcnow() - timedelta(days=random_days_ago)
        
        # Instantiate a single Order row
        new_order = Order(
            order_number=f"ORD-{2026}{i:04d}",
            customer_email=fake.safe_email(),
            status=random.choices(["completed", "refunded", "pending"], weights=[85, 10, 5])[0],
            store_id=random.choice(db_stores).id,
            created_at=order_date
        )
        db.add(new_order)
        db.flush() # Pulls new_order.id

        # Each order contains 1 to 4 independent item rows
        number_of_items = random.randint(1, 4)
        for _ in range(number_of_items):
            category = random.choice(list(product_catalog.keys()))
            product, base_price = random.choice(product_catalog[category])
            
            # Add minor random price fluctuations to simulate sales discounts
            actual_price = base_price * random.uniform(0.9, 1.1)

            new_item = OrderItem(
                order_id=new_order.id,
                product_name=product,
                category=category,
                quantity=random.randint(1, 3),
                unit_price=round(actual_price, 2)
            )
            db.add(new_item)

    db.commit()
    print("🎉 PostgreSQL successfully populated with BI transaction metrics logs!")
