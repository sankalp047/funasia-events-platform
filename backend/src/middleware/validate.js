const Joi = require("joi");

const validate = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) {
    return res.status(400).json({
      error: "Validation failed",
      details: error.details.map((d) => d.message),
    });
  }
  req.validated = value;
  next();
};

const validateQuery = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.query, { abortEarly: false, stripUnknown: true });
  if (error) {
    return res.status(400).json({
      error: "Validation failed",
      details: error.details.map((d) => d.message),
    });
  }
  req.validatedQuery = value;
  next();
};

// ─── Auth Schemas ───
const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  full_name: Joi.string().min(2).max(255).required(),
  phone: Joi.string().allow("", null),
  otp_code: Joi.string().length(6).pattern(/^\d{6}$/).required().messages({
    "string.length": "Verification code must be 6 digits",
    "string.pattern.base": "Verification code must be 6 digits",
    "any.required": "Verification code is required",
  }),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const phoneOtpSchema = Joi.object({
  phone: Joi.string().required(),
});

// ─── Event Schemas ───
const createEventSchema = Joi.object({
  title: Joi.string().min(3).max(255).required(),
  slug: Joi.string().pattern(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/).min(3).max(100).allow("", null),
  description: Joi.string().allow(""),
  short_description: Joi.string().max(500).allow(""),
  ticket_type: Joi.string().valid("free", "paid").required(),
  venue_name: Joi.string().required(),
  venue_address: Joi.string().required(),
  city: Joi.string().allow("", null),
  state: Joi.string().allow("", null).default("TX"),
  zip_code: Joi.string().allow(""),
  event_start: Joi.string().isoDate().required(),
  event_end: Joi.string().isoDate().required(),
  doors_open: Joi.string().isoDate().allow(null),
  seat_map_image_url: Joi.string().uri().allow("", null),
  category: Joi.string().valid("Music", "Nightlife", "Hobbies", "Business", "Dance", "concerts", "cultural", "conferences", "sports").allow("", null),
  is_online: Joi.boolean().default(false),
  is_global: Joi.boolean().default(false),
  meeting_link: Joi.string().uri().allow("", null),
  max_tickets_per_user: Joi.number().integer().min(1).max(50).default(10),
  tiers: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().required(),
        description: Joi.string().allow(""),
        price: Joi.number().min(0).required(),
        total_quantity: Joi.number().integer().min(1).required(),
        max_per_user: Joi.number().integer().min(1).default(10),
        sale_start: Joi.string().isoDate().allow(null),
        sale_end: Joi.string().isoDate().allow(null),
      })
    )
    .min(1)
    .required(),
  food_options: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().required(),
        description: Joi.string().allow(""),
        price: Joi.number().min(0).required(),
        category: Joi.string().valid("food", "drink", "combo").default("food"),
        is_vegetarian: Joi.boolean().default(false),
        is_vegan: Joi.boolean().default(false),
        max_quantity: Joi.number().integer().allow(null),
        image_url: Joi.string().uri().allow("", null),
      })
    )
    .default([]),
});

const searchEventsSchema = Joi.object({
  lat: Joi.number().min(-90).max(90),
  lng: Joi.number().min(-180).max(180),
  radius_miles: Joi.number().min(1).max(500).default(100),
  city: Joi.string().allow(""),
  state: Joi.string().allow(""),
  category: Joi.string().allow(""),
  search: Joi.string().allow(""),
  ticket_type: Joi.string().valid("free", "paid").allow(""),
  is_online: Joi.boolean(),
  is_global: Joi.boolean(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(20),
  sort: Joi.string().valid("date_asc", "date_desc", "price_asc", "price_desc", "popular").default("date_asc"),
});

// ─── Order / Checkout Schemas ───
const createOrderSchema = Joi.object({
  event_id: Joi.string().uuid().required(),
  items: Joi.array()
    .items(
      Joi.object({
        tier_id: Joi.string().uuid().required(),
        seat_id: Joi.string().uuid().allow(null),
        attendee_name: Joi.string().allow(""),
        attendee_email: Joi.string().email().allow(""),
        quantity: Joi.number().integer().min(1).default(1),
      })
    )
    .min(1)
    .required(),
  food_items: Joi.array()
    .items(
      Joi.object({
        food_option_id: Joi.string().uuid().required(),
        quantity: Joi.number().integer().min(1).required(),
      })
    )
    .default([]),
  promo_code: Joi.string().allow("", null),
});

// ─── Promo Code Schema ───
const createPromoSchema = Joi.object({
  event_id: Joi.string().uuid().allow(null),
  code: Joi.string().min(3).max(50).required(),
  discount_type: Joi.string().valid("percent", "flat").required(),
  discount_value: Joi.number().min(0).required(),
  max_uses: Joi.number().integer().allow(null),
  max_per_user: Joi.number().integer().default(1),
  min_order_amount: Joi.number().min(0).default(0),
  valid_from: Joi.string().isoDate().allow(null),
  valid_until: Joi.string().isoDate().allow(null),
});

module.exports = {
  validate,
  validateQuery,
  registerSchema,
  loginSchema,
  phoneOtpSchema,
  createEventSchema,
  searchEventsSchema,
  createOrderSchema,
  createPromoSchema,
};