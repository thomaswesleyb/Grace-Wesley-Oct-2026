-- Registry totals sum paid contributions per item.
CREATE INDEX contributions_item_status ON contributions (item_id, status);
